"""Bind a request Host to a tenant org slug.

Shared hosts (apex, app.*, admin.*, www, …) are unbound. A single-label
subdomain of BASE_DOMAIN / LEGACY_BASE_DOMAIN that is not an infra label
is the workspace slug (including reserved-but-bindable ``demo``).

When BASE_DOMAIN is unset (local/dev), nothing is bound and login stays
email-based on localhost.
"""

from __future__ import annotations

import re

from fastapi import Request

from app.config import settings

DEMO_ORG_SLUG = "demo"
# Signup-reserved but still a real tenant host.
_BINDABLE_RESERVED_SLUGS = frozenset({DEMO_ORG_SLUG})
_SLUG_RE = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")


def hostname_from_request(request: Request) -> str:
    raw = request.headers.get("host") or ""
    return raw.split(":", 1)[0].strip().lower()


def configured_apex_domains() -> list[str]:
    domains: list[str] = []
    for domain in (settings.BASE_DOMAIN, settings.LEGACY_BASE_DOMAIN):
        d = (domain or "").strip().lstrip(".").lower()
        if d:
            domains.append(d)
    return domains


def infra_host_labels() -> set[str]:
    labels = settings.get_reserved_slugs() - _BINDABLE_RESERVED_SLUGS
    for extra in (settings.APP_SUBDOMAIN, settings.PLATFORM_SUBDOMAIN):
        value = (extra or "").strip().lower()
        if value:
            labels.add(value)
    return labels


def tenant_host_enforced() -> bool:
    """True in production-style deploys where BASE_DOMAIN is configured."""
    return bool((settings.BASE_DOMAIN or "").strip())


def workspace_origin(slug: str) -> str:
    domain = (settings.BASE_DOMAIN or "").strip().lstrip(".")
    if not domain or not slug:
        return ""
    return f"https://{slug}.{domain}"


def demo_hostnames() -> frozenset[str]:
    return frozenset(f"{DEMO_ORG_SLUG}.{d}" for d in configured_apex_domains())


def bound_organization_slug(request: Request) -> str | None:
    """Return the workspace slug implied by Host, or None on shared/unknown hosts."""
    host = hostname_from_request(request)
    if not host:
        return None
    infra = infra_host_labels()
    for domain in configured_apex_domains():
        if host == domain:
            return None
        suffix = f".{domain}"
        if not host.endswith(suffix):
            continue
        label = host[: -len(suffix)]
        if not label or "." in label:
            return None
        if label in infra:
            return None
        if not _SLUG_RE.match(label):
            return None
        return label
    return None
