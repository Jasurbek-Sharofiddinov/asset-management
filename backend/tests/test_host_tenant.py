from app.services.host_tenant import (
    bound_organization_slug,
    demo_hostnames,
    hostname_from_request,
    tenant_host_enforced,
    workspace_origin,
)


class _Req:
    def __init__(self, host: str | None):
        self.headers = {"host": host} if host is not None else {}


def test_hostname_strips_port():
    assert hostname_from_request(_Req("demo.assetvault.uz:443")) == "demo.assetvault.uz"


def test_demo_hostnames_from_settings(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "datamou.uz")
    assert demo_hostnames() == frozenset({"demo.assetvault.uz", "demo.datamou.uz"})


def test_bound_slug_on_tenant_and_shared_hosts(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    monkeypatch.setattr(settings, "APP_SUBDOMAIN", "app")
    monkeypatch.setattr(settings, "PLATFORM_SUBDOMAIN", "admin")
    assert bound_organization_slug(_Req("demo.assetvault.uz")) == "demo"
    assert bound_organization_slug(_Req("acme.assetvault.uz")) == "acme"
    assert bound_organization_slug(_Req("app.assetvault.uz")) is None
    assert bound_organization_slug(_Req("admin.assetvault.uz")) is None
    assert bound_organization_slug(_Req("www.assetvault.uz")) is None
    assert bound_organization_slug(_Req("assetvault.uz")) is None
    assert bound_organization_slug(_Req("default.assetvault.uz")) is None
    assert bound_organization_slug(_Req("localhost:5173")) is None
    assert bound_organization_slug(_Req("foo.bar.assetvault.uz")) is None
    assert bound_organization_slug(_Req("-bad.assetvault.uz")) is None
    assert bound_organization_slug(_Req(None)) is None
    assert tenant_host_enforced() is True
    assert workspace_origin("acme") == "https://acme.assetvault.uz"


def test_unbound_when_base_domain_empty(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "")
    assert tenant_host_enforced() is False
    assert bound_organization_slug(_Req("demo.assetvault.uz")) is None
    assert workspace_origin("acme") == ""


def test_cors_origin_regex_matches_tenant_hosts(monkeypatch):
    import re
    from app.config import settings

    monkeypatch.setattr(settings, "BASE_DOMAIN", "assetvault.uz")
    monkeypatch.setattr(settings, "LEGACY_BASE_DOMAIN", "datamou.uz")
    pattern = settings.get_cors_origin_regex()
    assert pattern is not None
    compiled = re.compile(pattern)
    assert compiled.match("https://acme.assetvault.uz")
    assert compiled.match("https://app.assetvault.uz")
    assert compiled.match("https://assetvault.uz")
    assert compiled.match("https://demo.datamou.uz")
    assert compiled.match("https://evil.assetvault.uz.attacker.com") is None
    assert compiled.match("http://acme.assetvault.uz") is None
    assert compiled.match("https://foo.bar.assetvault.uz") is None
