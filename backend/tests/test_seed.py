from tests.conftest import pwd_context, _commit


async def test_seed_upsert_resets_seed_emails_and_leaves_others(
    db_session, org
):
    from seed import SEED_USERS, upsert_seed_users
    from app.models.user import User, UserRole
    from sqlalchemy import select

    org_id = org.id
    other = await _commit(
        db_session,
        User(
            organization_id=org_id,
            full_name="Keep Me",
            email="keepme@test.uz",
            hashed_password=pwd_context.hash("KeepPass1"),
            role=UserRole.VIEWER.value,
            is_active=True,
            must_change_password=False,
        ),
    )
    original_other_hash = other.hashed_password

    existing_admin = await _commit(
        db_session,
        User(
            organization_id=org_id,
            full_name="Old Admin",
            email="admin@assetvault.uz",
            hashed_password=pwd_context.hash("OldPass1"),
            role=UserRole.VIEWER.value,
            is_active=False,
            must_change_password=True,
        ),
    )

    # seed.upsert_seed_users uses a sync Session and seed.User, so call via
    # SQLAlchemy sync engine bound to the test database.
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import os

    engine = create_engine(os.environ["SYNC_DATABASE_URL"])
    Session = sessionmaker(bind=engine)
    with Session() as session:
        upsert_seed_users(session, org_id, "FreshSeed9")
        session.commit()

    db_session.expire_all()
    await db_session.refresh(other)
    assert other.hashed_password == original_other_hash

    result = await db_session.execute(
        select(User).where(
            User.organization_id == org_id,
            User.email == "admin@assetvault.uz",
        )
    )
    seeded = result.scalar_one()
    assert seeded.is_active is True
    assert seeded.must_change_password is False
    assert seeded.role == "ADMIN"
    assert pwd_context.verify("FreshSeed9", seeded.hashed_password)
    assert seeded.id == existing_admin.id

    emails = {email for email, _, _ in SEED_USERS}
    listed = await db_session.execute(
        select(User).where(
            User.organization_id == org_id,
            User.email.in_(emails),
        )
    )
    found = {u.email: u for u in listed.scalars().all()}
    assert set(found) == emails
    for user in found.values():
        assert pwd_context.verify("FreshSeed9", user.hashed_password)
        assert user.is_active is True
        assert user.must_change_password is False
