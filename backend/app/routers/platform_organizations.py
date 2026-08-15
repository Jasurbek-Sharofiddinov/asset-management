"""Platform organization review / activation routes."""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.platform_admin import PlatformAdmin
from app.platform_dependencies import get_current_platform_admin
from app.schemas.platform import (
    ActivateOrganizationRequest,
    ActivateOrganizationResponse,
    CreateOrganizationRequest,
    OrganizationListResponse,
    OrganizationPatchRequest,
    OrganizationPlatformDetail,
    OrganizationStatsResponse,
    PlatformAuditListResponse,
    RejectOrganizationRequest,
    SuspendOrganizationRequest,
)
from app.services import organization_service

router = APIRouter(prefix="/api/platform/organizations", tags=["platform-organizations"])
ops_router = APIRouter(prefix="/api/platform", tags=["platform"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("", response_model=OrganizationListResponse)
async def list_organizations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
    _admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    return await organization_service.list_organizations(
        db, page=page, size=size, status=status, q=q
    )


@router.post("", response_model=OrganizationPlatformDetail, status_code=201)
async def create_organization(
    body: CreateOrganizationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    org = await organization_service.create_organization(
        db,
        body=body,
        actor=admin,
        ip_address=_client_ip(request),
    )
    return OrganizationPlatformDetail.model_validate(org)


@router.get("/{org_id}", response_model=OrganizationPlatformDetail)
async def get_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    return await organization_service.get_organization_detail(db, org_id)


@router.post("/{org_id}/activate", response_model=ActivateOrganizationResponse)
async def activate_organization(
    org_id: uuid.UUID,
    body: ActivateOrganizationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    org, invite_token, admin_user = await organization_service.activate_organization(
        db,
        org_id=org_id,
        body=body,
        actor=admin,
        ip_address=_client_ip(request),
    )
    return ActivateOrganizationResponse(
        organization=OrganizationPlatformDetail.model_validate(org),
        invite_token=invite_token,
        admin_email=admin_user.email,
        admin_user_id=admin_user.id,
    )


@router.post("/{org_id}/reject", response_model=OrganizationPlatformDetail)
async def reject_organization(
    org_id: uuid.UUID,
    body: RejectOrganizationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    org = await organization_service.reject_organization(
        db,
        org_id=org_id,
        body=body,
        actor=admin,
        ip_address=_client_ip(request),
    )
    return OrganizationPlatformDetail.model_validate(org)


@router.post("/{org_id}/suspend", response_model=OrganizationPlatformDetail)
async def suspend_organization(
    org_id: uuid.UUID,
    request: Request,
    body: SuspendOrganizationRequest | None = None,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    reason = body.reason if body else None
    org = await organization_service.suspend_organization(
        db,
        org_id=org_id,
        actor=admin,
        reason=reason,
        ip_address=_client_ip(request),
    )
    return OrganizationPlatformDetail.model_validate(org)


@router.post("/{org_id}/reactivate", response_model=OrganizationPlatformDetail)
async def reactivate_organization(
    org_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    org = await organization_service.reactivate_organization(
        db,
        org_id=org_id,
        actor=admin,
        ip_address=_client_ip(request),
    )
    return OrganizationPlatformDetail.model_validate(org)


@router.patch("/{org_id}", response_model=OrganizationPlatformDetail)
async def patch_organization(
    org_id: uuid.UUID,
    body: OrganizationPatchRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    org = await organization_service.patch_organization(
        db,
        org_id=org_id,
        body=body,
        actor=admin,
        ip_address=_client_ip(request),
    )
    return OrganizationPlatformDetail.model_validate(org)


@ops_router.get("/stats", response_model=OrganizationStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    return await organization_service.organization_stats(db)


@ops_router.get("/audit", response_model=PlatformAuditListResponse)
async def list_audit(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _admin: PlatformAdmin = Depends(get_current_platform_admin),
):
    return await organization_service.list_platform_audit(db, page=page, size=size)
