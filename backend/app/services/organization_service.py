"""Organization lifecycle for platform review / activation.

Mirrors asset_service ALLOWED_TRANSITIONS + InvalidTransitionException (HTTP 409).
Platform queries intentionally do NOT filter by tenant organization_id.
"""

from __future__ import annotations

import math
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from passlib.context import CryptContext
from sqlalchemy import select, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.exceptions import (
    BadRequestException,
    ConflictException,
    InvalidTransitionException,
    NotFoundException,
)
from app.models.organization import Organization, OrganizationPlan, OrganizationStatus
from app.models.platform_admin import PlatformAdmin
from app.models.platform_audit import PlatformAuditLog
from app.models.user import User, UserRole
from app.schemas.platform import (
    ActivateOrganizationRequest,
    CreateOrganizationRequest,
    OrganizationListResponse,
    OrganizationPatchRequest,
    OrganizationPlatformDetail,
    OrganizationPlatformSummary,
    OrganizationStatsResponse,
    PlatformAuditEntry,
    PlatformAuditListResponse,
    RejectOrganizationRequest,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    OrganizationStatus.PENDING_REVIEW.value: {
        OrganizationStatus.TRIALING.value,
        OrganizationStatus.REJECTED.value,
    },
    OrganizationStatus.REJECTED.value: set(),
    OrganizationStatus.TRIALING.value: {
        OrganizationStatus.ACTIVE.value,
        OrganizationStatus.SUSPENDED.value,
        OrganizationStatus.DELETED.value,
    },
    OrganizationStatus.ACTIVE.value: {
        OrganizationStatus.PAST_DUE.value,
        OrganizationStatus.SUSPENDED.value,
        OrganizationStatus.DELETED.value,
    },
    OrganizationStatus.PAST_DUE.value: {
        OrganizationStatus.ACTIVE.value,
        OrganizationStatus.SUSPENDED.value,
        OrganizationStatus.DELETED.value,
    },
    OrganizationStatus.SUSPENDED.value: {
        OrganizationStatus.ACTIVE.value,
        OrganizationStatus.DELETED.value,
    },
    OrganizationStatus.DELETED.value: set(),
}

_SLUG_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")
_NON_SLUG_RE = re.compile(r"[^a-z0-9]+")


def validate_transition(current_status: str, target_status: str) -> None:
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise InvalidTransitionException(current_status, target_status)


def validate_slug(slug: str) -> str:
    """Validate and normalize an organization slug. Raises BadRequestException."""
    normalized = (slug or "").strip().lower()
    if len(normalized) < 3 or len(normalized) > 63:
        raise BadRequestException("Slug must be between 3 and 63 characters")
    if not _SLUG_RE.match(normalized):
        raise BadRequestException(
            "Slug must be lowercase alphanumeric with optional hyphens, "
            "and must start and end with an alphanumeric character"
        )
    reserved = settings.get_reserved_slugs()
    if normalized in reserved:
        raise BadRequestException(f"Slug '{normalized}' is reserved")
    return normalized


def slugify_name(name: str) -> str:
    """Derive a slug candidate from an organization name (not uniqueness-checked)."""
    raw = (name or "").strip().lower()
    slug = _NON_SLUG_RE.sub("-", raw).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    if len(slug) < 3:
        slug = (slug + "org") if slug else "org"
        if len(slug) < 3:
            slug = slug.ljust(3, "x")
    if len(slug) > 50:
        slug = slug[:50].rstrip("-")
        if not slug:
            slug = "org"
    if not _SLUG_RE.match(slug) or slug in settings.get_reserved_slugs():
        return "org"
    return slug


async def _slug_taken(
    db: AsyncSession, slug: str, exclude_id: uuid.UUID | None = None
) -> bool:
    query = select(Organization.id).where(Organization.slug == slug)
    if exclude_id is not None:
        query = query.where(Organization.id != exclude_id)
    return (await db.execute(query)).scalar_one_or_none() is not None


async def allocate_unique_slug(
    db: AsyncSession,
    name: str,
    preferred: str | None = None,
) -> str:
    """Return a unique, valid slug.

    If `preferred` is given it must be free (409 if taken). Otherwise derive
    from `name` and append a numeric suffix until unique.
    """
    if preferred:
        base = validate_slug(preferred)
        if await _slug_taken(db, base):
            raise ConflictException(f"Slug '{base}' is already taken")
        return base

    base = slugify_name(name)
    n = 1
    while n <= 1000:
        suffix = "" if n == 1 else f"-{n}"
        candidate = f"{base[: 63 - len(suffix)]}{suffix}".rstrip("-")
        try:
            normalized = validate_slug(candidate)
        except BadRequestException:
            n += 1
            continue
        if not await _slug_taken(db, normalized):
            return normalized
        n += 1
    raise ConflictException("Unable to allocate a unique slug")


async def _write_platform_audit(
    db: AsyncSession,
    *,
    actor: PlatformAdmin | None,
    action: str,
    organization: Organization | None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    reason: str | None = None,
    ip_address: str | None = None,
    target_type: str = "organization",
    target_id: str | None = None,
    actor_email: str | None = None,
) -> None:
    entry = PlatformAuditLog(
        actor_id=actor.id if actor else None,
        actor_email=(actor.email if actor else None) or actor_email or "public-signup",
        action=action,
        target_organization_id=organization.id if organization else None,
        target_type=target_type,
        target_id=target_id or (str(organization.id) if organization else None),
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        ip_address=ip_address,
    )
    db.add(entry)


async def get_organization_or_404(
    db: AsyncSession, org_id: uuid.UUID
) -> Organization:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if org is None:
        raise NotFoundException("Organization not found")
    return org


async def list_organizations(
    db: AsyncSession,
    *,
    page: int = 1,
    size: int = 20,
    status: Optional[str] = None,
    q: Optional[str] = None,
) -> OrganizationListResponse:
    filters = []
    if status:
        filters.append(Organization.status == status)
    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        filters.append(
            or_(
                Organization.name.ilike(like),
                Organization.slug.ilike(like),
                Organization.contact_email.ilike(like),
            )
        )

    count_q = select(func.count()).select_from(Organization)
    if filters:
        count_q = count_q.where(*filters)
    total = (await db.execute(count_q)).scalar() or 0

    query = select(Organization).order_by(Organization.created_at.desc())
    if filters:
        query = query.where(*filters)
    query = query.offset((page - 1) * size).limit(size)

    rows = (await db.execute(query)).scalars().all()
    pages = max(1, math.ceil(total / size)) if total else 1

    return OrganizationListResponse(
        items=[OrganizationPlatformSummary.model_validate(r) for r in rows],
        total=total,
        page=page,
        pages=pages,
    )


async def get_organization_detail(
    db: AsyncSession, org_id: uuid.UUID
) -> OrganizationPlatformDetail:
    org = await get_organization_or_404(db, org_id)
    return OrganizationPlatformDetail.model_validate(org)


async def organization_stats(db: AsyncSession) -> OrganizationStatsResponse:
    by_status = {s.value: 0 for s in OrganizationStatus}
    rows = (
        await db.execute(
            select(Organization.status, func.count())
            .select_from(Organization)
            .group_by(Organization.status)
        )
    ).all()
    total = 0
    for status, count in rows:
        by_status[status] = int(count)
        total += int(count)

    now = datetime.now(timezone.utc)
    soon = now + timedelta(days=7)
    expiring = (
        await db.execute(
            select(Organization)
            .where(
                Organization.status == OrganizationStatus.TRIALING.value,
                Organization.trial_ends_at.isnot(None),
                Organization.trial_ends_at > now,
                Organization.trial_ends_at <= soon,
            )
            .order_by(Organization.trial_ends_at.asc())
            .limit(10)
        )
    ).scalars().all()

    return OrganizationStatsResponse(
        total=total,
        by_status=by_status,
        pending_review=by_status.get(OrganizationStatus.PENDING_REVIEW.value, 0),
        trials_expiring_soon=[
            OrganizationPlatformSummary.model_validate(r) for r in expiring
        ],
    )


async def list_platform_audit(
    db: AsyncSession,
    *,
    page: int = 1,
    size: int = 20,
) -> PlatformAuditListResponse:
    total = (
        await db.execute(select(func.count()).select_from(PlatformAuditLog))
    ).scalar() or 0
    rows = (
        await db.execute(
            select(PlatformAuditLog)
            .order_by(PlatformAuditLog.occurred_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    ).scalars().all()
    pages = max(1, math.ceil(total / size)) if total else 1
    return PlatformAuditListResponse(
        items=[PlatformAuditEntry.model_validate(r) for r in rows],
        total=total,
        page=page,
        pages=pages,
    )


async def create_organization(
    db: AsyncSession,
    *,
    body: CreateOrganizationRequest,
    actor: PlatformAdmin,
    ip_address: str | None = None,
) -> Organization:
    slug = await allocate_unique_slug(db, body.name, preferred=body.slug)
    plan = body.plan.value if body.plan else OrganizationPlan.STARTER.value

    org = Organization(
        name=body.name.strip(),
        slug=slug,
        status=OrganizationStatus.PENDING_REVIEW.value,
        plan=plan,
        contact_email=body.contact_email,
        notes=body.notes,
    )
    db.add(org)
    await db.flush()

    await _write_platform_audit(
        db,
        actor=actor,
        action="organization.create",
        organization=org,
        new_value={
            "name": org.name,
            "slug": org.slug,
            "status": org.status,
            "plan": org.plan,
            "contact_email": org.contact_email,
        },
        ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(org)
    return org


async def submit_organization_application(
    db: AsyncSession,
    *,
    organization_name: str,
    contact_email: str,
    admin_full_name: str,
    password: str,
    contact_phone: str | None = None,
    website: str | None = None,
    country: str | None = None,
    institution_type: str | None = None,
    use_case: str | None = None,
    signup_ip: str | None = None,
    signup_user_agent: str | None = None,
) -> None:
    """Public intake. Always silent to the caller (anti-enumeration)."""
    email = contact_email.strip().lower()

    existing = await db.execute(
        select(Organization).where(
            Organization.contact_email == email,
            Organization.status == OrganizationStatus.PENDING_REVIEW.value,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return

    hashed = pwd_context.hash(password)

    for _ in range(3):
        slug = await allocate_unique_slug(db, organization_name)
        org = Organization(
            name=organization_name.strip(),
            slug=slug,
            status=OrganizationStatus.PENDING_REVIEW.value,
            plan=OrganizationPlan.STARTER.value,
            contact_email=email,
            contact_phone=contact_phone,
            website=website,
            country=country,
            institution_type=institution_type,
            use_case=use_case,
            signup_ip=signup_ip,
            signup_user_agent=signup_user_agent,
        )
        db.add(org)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            continue

        admin_user = User(
            organization_id=org.id,
            full_name=admin_full_name.strip(),
            email=email,
            hashed_password=hashed,
            role=UserRole.ADMIN.value,
            is_active=True,
        )
        db.add(admin_user)
        await _write_platform_audit(
            db,
            actor=None,
            actor_email="public-signup",
            action="organization.signup",
            organization=org,
            new_value={
                "name": org.name,
                "slug": org.slug,
                "status": org.status,
                "contact_email": email,
            },
            ip_address=signup_ip,
        )
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            continue
        return


async def activate_organization(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    body: ActivateOrganizationRequest,
    actor: PlatformAdmin,
    ip_address: str | None = None,
) -> tuple[Organization, str | None, User]:
    """Activate a pending org: trialing + trial clock + first ADMIN.

    Adopts an existing applicant user (returns invite_token=None). Mints a
    one-time invite token only when no user exists yet (operator-created orgs).
    """
    org = await get_organization_or_404(db, org_id)
    validate_transition(org.status, OrganizationStatus.TRIALING.value)

    confirmed_slug = validate_slug(body.slug)
    if confirmed_slug != org.slug:
        if await _slug_taken(db, confirmed_slug, exclude_id=org.id):
            raise ConflictException(f"Slug '{confirmed_slug}' is already taken")
        org.slug = confirmed_slug

    admin_email = (body.admin_email or org.contact_email or "").strip().lower()
    if not admin_email:
        raise BadRequestException(
            "admin_email is required when the organization has no contact_email"
        )
    admin_full_name = (body.admin_full_name or "").strip() or f"{org.name} Admin"

    plan = body.plan.value if body.plan else OrganizationPlan.STARTER.value

    existing_user = (
        await db.execute(
            select(User).where(
                User.organization_id == org.id,
                User.email == admin_email,
            )
        )
    ).scalar_one_or_none()

    old_status = org.status
    old_plan = org.plan
    now = datetime.now(timezone.utc)
    trial_ends = now + timedelta(days=settings.TRIAL_LENGTH_DAYS)

    invite_token: str | None = None
    if existing_user:
        admin_user = existing_user
        if body.admin_full_name and admin_full_name:
            admin_user.full_name = admin_full_name
        admin_user.is_active = True
        admin_user.role = UserRole.ADMIN.value
    else:
        invite_token = secrets.token_urlsafe(32)
        hashed = pwd_context.hash(invite_token)
        admin_user = User(
            organization_id=org.id,
            full_name=admin_full_name,
            email=admin_email,
            hashed_password=hashed,
            role=UserRole.ADMIN.value,
            is_active=True,
            must_change_password=True,
        )
        db.add(admin_user)

    org.status = OrganizationStatus.TRIALING.value
    org.plan = plan
    org.trial_ends_at = trial_ends
    org.reviewed_at = now
    org.reviewed_by = actor.id
    org.rejection_reason = None

    await _write_platform_audit(
        db,
        actor=actor,
        action="organization.activate",
        organization=org,
        old_value={"status": old_status, "plan": old_plan},
        new_value={
            "status": org.status,
            "plan": plan,
            "slug": org.slug,
            "trial_ends_at": trial_ends.isoformat(),
            "admin_email": admin_email,
            "adopted_existing_admin": existing_user is not None,
        },
        ip_address=ip_address,
    )

    await db.commit()
    await db.refresh(org)
    await db.refresh(admin_user)
    return org, invite_token, admin_user


async def reject_organization(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    body: RejectOrganizationRequest,
    actor: PlatformAdmin,
    ip_address: str | None = None,
) -> Organization:
    org = await get_organization_or_404(db, org_id)
    validate_transition(org.status, OrganizationStatus.REJECTED.value)

    reason = (body.reason or "").strip()
    if not reason:
        raise BadRequestException("Rejection reason is required")

    old_status = org.status
    now = datetime.now(timezone.utc)
    org.status = OrganizationStatus.REJECTED.value
    org.rejection_reason = reason
    org.reviewed_at = now
    org.reviewed_by = actor.id

    await _write_platform_audit(
        db,
        actor=actor,
        action="organization.reject",
        organization=org,
        old_value={"status": old_status},
        new_value={"status": org.status},
        reason=reason,
        ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(org)
    return org


async def suspend_organization(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor: PlatformAdmin,
    reason: str | None = None,
    ip_address: str | None = None,
) -> Organization:
    org = await get_organization_or_404(db, org_id)
    validate_transition(org.status, OrganizationStatus.SUSPENDED.value)

    old_status = org.status
    org.status = OrganizationStatus.SUSPENDED.value

    await _write_platform_audit(
        db,
        actor=actor,
        action="organization.suspend",
        organization=org,
        old_value={"status": old_status},
        new_value={"status": org.status},
        reason=reason,
        ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(org)
    return org


async def reactivate_organization(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    actor: PlatformAdmin,
    ip_address: str | None = None,
) -> Organization:
    """Reactivate a suspended (or past_due) org back to active."""
    org = await get_organization_or_404(db, org_id)
    validate_transition(org.status, OrganizationStatus.ACTIVE.value)

    old_status = org.status
    org.status = OrganizationStatus.ACTIVE.value

    await _write_platform_audit(
        db,
        actor=actor,
        action="organization.reactivate",
        organization=org,
        old_value={"status": old_status},
        new_value={"status": org.status},
        ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(org)
    return org


async def patch_organization(
    db: AsyncSession,
    *,
    org_id: uuid.UUID,
    body: OrganizationPatchRequest,
    actor: PlatformAdmin,
    ip_address: str | None = None,
) -> Organization:
    """Update name/plan/notes/trial_ends_at — cannot change status."""
    org = await get_organization_or_404(db, org_id)

    old_value: dict = {
        "name": org.name,
        "plan": org.plan,
        "notes": org.notes,
        "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
    }
    changed = False

    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise BadRequestException("Name cannot be empty")
        org.name = name
        changed = True
    if body.plan is not None:
        org.plan = body.plan.value
        changed = True
    if body.notes is not None:
        org.notes = body.notes
        changed = True
    if body.trial_ends_at is not None:
        org.trial_ends_at = body.trial_ends_at
        changed = True

    if not changed:
        return org

    await _write_platform_audit(
        db,
        actor=actor,
        action="organization.patch",
        organization=org,
        old_value=old_value,
        new_value={
            "name": org.name,
            "plan": org.plan,
            "notes": org.notes,
            "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        },
        ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(org)
    return org
