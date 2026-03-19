"""
Seed script for AssetVault database.
Uses synchronous SQLAlchemy for simplicity.
Creates branches, departments, employees, users, assets, assignments, and audit logs.
"""

import uuid
import random
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal

from faker import Faker
from passlib.context import CryptContext
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, Date, Numeric
from sqlalchemy import Text, BigInteger, ForeignKey, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, sessionmaker

# ── Configuration ────────────────────────────────────────────────────────────

import os
DATABASE_URL = os.environ.get("SYNC_DATABASE_URL", "postgresql://postgres:12345@localhost:5432/assetvault")

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()
fake = Faker()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Sync ORM Models (mirrors async models) ──────────────────────────────────


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(512), nullable=False)
    role = Column(String(20), nullable=False, default="VIEWER")
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class Department(Base):
    __tablename__ = "departments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)


class Branch(Base):
    __tablename__ = "branches"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=True)


class Employee(Base):
    __tablename__ = "employees"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=True)
    position = Column(String(100), nullable=True)


class Asset(Base):
    __tablename__ = "assets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    asset_type = Column(String(100), nullable=False)
    category = Column(String(20), nullable=False, default="OTHER")
    serial_number = Column(String(255), unique=True, nullable=False)
    brand = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    purchase_date = Column(Date, nullable=True)
    purchase_price = Column(Numeric(12, 2), nullable=True)
    warranty_expiry = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(String(512), nullable=True)
    status = Column(String(20), nullable=False, default="REGISTERED")
    qr_code_url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id"), nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    returned_at = Column(DateTime(timezone=True), nullable=True)
    return_reason = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    actor_name = Column(String(255), nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Seed Data ────────────────────────────────────────────────────────────────

BRANCHES = [
    ("HQ Tashkent", "Tashkent, Amir Temur Avenue 1"),
    ("Samarkand Branch", "Samarkand, Registan Square 5"),
    ("Namangan Branch", "Namangan, Navoi Street 12"),
    ("Bukhara Branch", "Bukhara, Lyabi-Hauz 3"),
    ("Fergana Branch", "Fergana, Al-Fergani Street 8"),
]

DEPARTMENTS = [
    "IT", "HR", "Finance", "Security",
    "Operations", "Legal", "Customer Service", "Management",
]

POSITIONS = [
    "Specialist", "Senior Specialist", "Manager", "Team Lead",
    "Director", "Analyst", "Engineer", "Coordinator",
    "Administrator", "Officer",
]

ASSET_TEMPLATES = {
    "IT": [
        ("Dell Latitude Laptop", "Laptop", "Dell", ["Latitude 5540", "Latitude 7440", "Latitude 5530"]),
        ("HP ProBook Laptop", "Laptop", "HP", ["ProBook 450 G10", "ProBook 440 G10"]),
        ("Lenovo ThinkPad", "Laptop", "Lenovo", ["ThinkPad T14s", "ThinkPad X1 Carbon"]),
        ("Dell OptiPlex Desktop", "Desktop", "Dell", ["OptiPlex 7010", "OptiPlex 5000"]),
        ("Dell Monitor", "Monitor", "Dell", ["P2422H", "U2723QE", "P2723QE"]),
        ("LG UltraWide Monitor", "Monitor", "LG", ["34WN80C-B", "27UK850-W"]),
    ],
    "OFFICE": [
        ("Office Chair", "Furniture", "Herman Miller", ["Aeron", "Mirra 2"]),
        ("Standing Desk", "Furniture", "Uplift", ["V2", "V2 Commercial"]),
        ("Whiteboard", "Equipment", "Quartet", ["Standard 6x4", "Glass 4x3"]),
        ("Projector", "Equipment", "Epson", ["EB-992F", "EB-FH52"]),
    ],
    "SECURITY": [
        ("IP Camera", "Camera", "Hikvision", ["DS-2CD2143G2-I", "DS-2CD2T47G2-L"]),
        ("Access Control Panel", "Access Control", "ZKTeco", ["inBio160", "inBio260"]),
        ("Metal Detector", "Detector", "Garrett", ["PD 6500i", "CS 5000"]),
    ],
    "NETWORKING": [
        ("Cisco Switch", "Network Switch", "Cisco", ["Catalyst 9200", "Catalyst 9300"]),
        ("Cisco Router", "Router", "Cisco", ["ISR 4321", "ISR 4431"]),
        ("Ubiquiti Access Point", "Access Point", "Ubiquiti", ["U6-Pro", "U6-Enterprise"]),
        ("Cisco Firewall", "Firewall", "Cisco", ["Firepower 1010", "Firepower 2110"]),
    ],
    "PRINTING": [
        ("HP LaserJet Printer", "Printer", "HP", ["M404dn", "M507dn", "M283fdw"]),
        ("Canon Printer", "Printer", "Canon", ["imageRUNNER C3530i", "imageRUNNER 2630i"]),
        ("Xerox Copier", "Copier", "Xerox", ["VersaLink C7025", "AltaLink C8055"]),
    ],
    "SERVER": [
        ("Dell PowerEdge Server", "Server", "Dell", ["R750", "R650", "T550"]),
        ("HP ProLiant Server", "Server", "HP", ["DL380 Gen10", "DL360 Gen10"]),
        ("UPS System", "UPS", "APC", ["Smart-UPS 3000", "Smart-UPS 5000"]),
    ],
    "MOBILE": [
        ("iPhone", "Smartphone", "Apple", ["iPhone 15 Pro", "iPhone 14"]),
        ("Samsung Galaxy", "Smartphone", "Samsung", ["Galaxy S24", "Galaxy A54"]),
        ("iPad", "Tablet", "Apple", ["iPad Pro 12.9", "iPad Air"]),
    ],
    "FURNITURE": [
        ("Executive Desk", "Desk", "Steelcase", ["Migration SE", "Currency"]),
        ("Filing Cabinet", "Storage", "HON", ["310 Series", "Brigade 600"]),
        ("Conference Table", "Table", "Knoll", ["Reff Profiles", "Antenna"]),
        ("Bookshelf", "Storage", "IKEA", ["Billy", "Kallax"]),
    ],
}

STATUS_WEIGHTS = {
    "ASSIGNED": 60,
    "REGISTERED": 15,
    "IN_REPAIR": 10,
    "LOST": 8,
    "WRITTEN_OFF": 7,
}

RETURN_REASONS = [
    "Employee transferred to another branch",
    "Equipment upgrade",
    "End of project assignment",
    "Maintenance required",
    "Employee resignation",
    "Department restructuring",
    "Device malfunction",
    "Warranty replacement",
]

AUDIT_ACTIONS = [
    "CREATE", "UPDATE", "STATUS_CHANGE", "ASSIGN", "RETURN", "DELETE",
]

IP_ADDRESSES = [
    "192.168.1.10", "192.168.1.15", "192.168.1.20",
    "192.168.2.10", "192.168.2.15", "10.0.0.5",
    "10.0.0.10", "10.0.1.5", "172.16.0.10",
]


def random_date(start_year: int = 2020, end_year: int = 2025) -> date:
    start = date(start_year, 1, 1)
    end = date(end_year, 12, 31)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def random_datetime(start_year: int = 2023, end_year: int = 2025) -> datetime:
    d = random_date(start_year, end_year)
    return datetime(
        d.year, d.month, d.day,
        random.randint(8, 18), random.randint(0, 59), random.randint(0, 59),
        tzinfo=timezone.utc,
    )


def weighted_status() -> str:
    statuses = list(STATUS_WEIGHTS.keys())
    weights = list(STATUS_WEIGHTS.values())
    return random.choices(statuses, weights=weights, k=1)[0]


def generate_serial() -> str:
    prefix = random.choice(["SN", "AST", "INV", "EQ", "HW"])
    return f"{prefix}-{random.randint(100000, 999999)}-{random.randint(10, 99)}"


def seed():
    # Create tables
    Base.metadata.create_all(engine)

    session = SessionLocal()

    try:
        # Check if already seeded
        existing_users = session.query(User).count()
        if existing_users > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # ── Users ────────────────────────────────────────────────────────
        hashed_pw = pwd_context.hash("Vault@2024")
        admin = User(
            id=uuid.uuid4(),
            full_name="Admin User",
            email="admin@assetvault.uz",
            hashed_password=hashed_pw,
            role="ADMIN",
            is_active=True,
        )
        manager = User(
            id=uuid.uuid4(),
            full_name="Manager User",
            email="manager@assetvault.uz",
            hashed_password=hashed_pw,
            role="MANAGER",
            is_active=True,
        )
        auditor = User(
            id=uuid.uuid4(),
            full_name="Auditor User",
            email="auditor@assetvault.uz",
            hashed_password=hashed_pw,
            role="AUDITOR",
            is_active=True,
        )
        users = [admin, manager, auditor]
        session.add_all(users)
        session.flush()
        print(f"  Created {len(users)} users")

        # ── Branches ─────────────────────────────────────────────────────
        branches = []
        for name, location in BRANCHES:
            branch = Branch(id=uuid.uuid4(), name=name, location=location)
            branches.append(branch)
        session.add_all(branches)
        session.flush()
        print(f"  Created {len(branches)} branches")

        # ── Departments ──────────────────────────────────────────────────
        departments = []
        for name in DEPARTMENTS:
            dept = Department(id=uuid.uuid4(), name=name)
            departments.append(dept)
        session.add_all(departments)
        session.flush()
        print(f"  Created {len(departments)} departments")

        # ── Employees ────────────────────────────────────────────────────
        employees = []
        used_emails = set()
        for i in range(30):
            while True:
                email = fake.email()
                if email not in used_emails:
                    used_emails.add(email)
                    break
            emp = Employee(
                id=uuid.uuid4(),
                full_name=fake.name(),
                email=email,
                department_id=random.choice(departments).id,
                branch_id=random.choice(branches).id,
                position=random.choice(POSITIONS),
            )
            employees.append(emp)
        session.add_all(employees)
        session.flush()
        print(f"  Created {len(employees)} employees")

        # ── Assets ───────────────────────────────────────────────────────
        assets = []
        used_serials = set()
        actor_users = [admin, manager]

        for i in range(300):
            category = random.choice(list(ASSET_TEMPLATES.keys()))
            template = random.choice(ASSET_TEMPLATES[category])
            name_base, asset_type, brand, models = template
            model_name = random.choice(models)

            while True:
                serial = generate_serial()
                if serial not in used_serials:
                    used_serials.add(serial)
                    break

            purchase_dt = random_date(2019, 2025)
            warranty_months = random.choice([12, 24, 36, 48, 60])
            warranty_exp = purchase_dt + timedelta(days=warranty_months * 30)
            price = Decimal(str(round(random.uniform(50, 15000), 2)))

            status = weighted_status()
            created_at = random_datetime(2023, 2025)

            asset = Asset(
                id=uuid.uuid4(),
                name=f"{name_base} #{i+1}",
                asset_type=asset_type,
                category=category,
                serial_number=serial,
                brand=brand,
                model=model_name,
                purchase_date=purchase_dt,
                purchase_price=price,
                warranty_expiry=warranty_exp,
                description=f"{brand} {model_name} - {asset_type} for {category} department use",
                status=status,
                created_by=random.choice(actor_users).id,
                created_at=created_at,
                updated_at=created_at,
            )

            # Soft-delete some WRITTEN_OFF assets
            if status == "WRITTEN_OFF" and random.random() < 0.3:
                asset.deleted_at = created_at + timedelta(days=random.randint(1, 60))

            assets.append(asset)

        session.add_all(assets)
        session.flush()
        print(f"  Created {len(assets)} assets")

        # ── Assignments ──────────────────────────────────────────────────
        assignments = []
        assigned_assets = [a for a in assets if a.status == "ASSIGNED"]

        for asset in assigned_assets:
            emp = random.choice(employees)
            assigned_at = asset.created_at + timedelta(days=random.randint(0, 30))

            assignment = Assignment(
                id=uuid.uuid4(),
                asset_id=asset.id,
                employee_id=emp.id,
                department_id=emp.department_id,
                branch_id=emp.branch_id,
                assigned_by=random.choice(actor_users).id,
                assigned_at=assigned_at,
                is_active=True,
                notes=random.choice([None, "Standard issue", "Project-specific assignment", "Temporary allocation"]),
            )
            assignments.append(assignment)

        # Add some historical (returned) assignments for non-assigned assets
        for asset in assets:
            if asset.status != "ASSIGNED" and random.random() < 0.4:
                emp = random.choice(employees)
                assigned_at = asset.created_at + timedelta(days=random.randint(0, 15))
                returned_at = assigned_at + timedelta(days=random.randint(10, 180))

                assignment = Assignment(
                    id=uuid.uuid4(),
                    asset_id=asset.id,
                    employee_id=emp.id,
                    department_id=emp.department_id,
                    branch_id=emp.branch_id,
                    assigned_by=random.choice(actor_users).id,
                    assigned_at=assigned_at,
                    returned_at=returned_at,
                    return_reason=random.choice(RETURN_REASONS),
                    is_active=False,
                    notes="Historical assignment",
                )
                assignments.append(assignment)

        session.add_all(assignments)
        session.flush()
        print(f"  Created {len(assignments)} assignments")

        # ── Audit Logs ───────────────────────────────────────────────────
        audit_logs = []

        for asset in assets:
            actor = random.choice(actor_users)

            # CREATE log
            audit_logs.append(AuditLog(
                entity_type="asset",
                entity_id=asset.id,
                action="CREATE",
                actor_id=actor.id,
                actor_name=actor.full_name,
                new_value={
                    "name": asset.name,
                    "serial_number": asset.serial_number,
                    "category": asset.category,
                },
                ip_address=random.choice(IP_ADDRESSES),
                occurred_at=asset.created_at,
            ))

            # STATUS_CHANGE logs
            num_changes = random.randint(0, 3)
            for _ in range(num_changes):
                old_status = random.choice(["REGISTERED", "ASSIGNED", "IN_REPAIR"])
                new_status = random.choice(["ASSIGNED", "IN_REPAIR", "REGISTERED"])
                if old_status != new_status:
                    occurred = asset.created_at + timedelta(days=random.randint(1, 200))
                    actor = random.choice(actor_users)
                    audit_logs.append(AuditLog(
                        entity_type="asset",
                        entity_id=asset.id,
                        action="STATUS_CHANGE",
                        actor_id=actor.id,
                        actor_name=actor.full_name,
                        old_value={"status": old_status},
                        new_value={"status": new_status},
                        reason=random.choice([None, "Routine maintenance", "User request", "Inventory audit"]),
                        ip_address=random.choice(IP_ADDRESSES),
                        occurred_at=occurred,
                    ))

        # ASSIGN and RETURN logs
        for assignment in assignments:
            actor = random.choice(actor_users)
            audit_logs.append(AuditLog(
                entity_type="asset",
                entity_id=assignment.asset_id,
                action="ASSIGN",
                actor_id=actor.id,
                actor_name=actor.full_name,
                new_value={"assignment_id": str(assignment.id)},
                ip_address=random.choice(IP_ADDRESSES),
                occurred_at=assignment.assigned_at,
            ))

            if assignment.returned_at:
                audit_logs.append(AuditLog(
                    entity_type="asset",
                    entity_id=assignment.asset_id,
                    action="RETURN",
                    actor_id=actor.id,
                    actor_name=actor.full_name,
                    old_value={"assignment_id": str(assignment.id)},
                    reason=assignment.return_reason,
                    ip_address=random.choice(IP_ADDRESSES),
                    occurred_at=assignment.returned_at,
                ))

        # Some UPDATE logs
        for asset in random.sample(assets, min(40, len(assets))):
            actor = random.choice(actor_users)
            occurred = asset.created_at + timedelta(days=random.randint(1, 100))
            audit_logs.append(AuditLog(
                entity_type="asset",
                entity_id=asset.id,
                action="UPDATE",
                actor_id=actor.id,
                actor_name=actor.full_name,
                old_value={"name": asset.name},
                new_value={"name": asset.name, "description": "Updated description"},
                ip_address=random.choice(IP_ADDRESSES),
                occurred_at=occurred,
            ))

        session.add_all(audit_logs)
        session.flush()
        print(f"  Created {len(audit_logs)} audit log entries")

        session.commit()
        print("\nSeed completed successfully!")
        print(f"  Total users:       {len(users)}")
        print(f"  Total branches:    {len(branches)}")
        print(f"  Total departments: {len(departments)}")
        print(f"  Total employees:   {len(employees)}")
        print(f"  Total assets:      {len(assets)}")
        print(f"  Total assignments: {len(assignments)}")
        print(f"  Total audit logs:  {len(audit_logs)}")
        print("\nLogin credentials:")
        print("  admin@assetvault.uz   / Vault@2024  (ADMIN)")
        print("  manager@assetvault.uz / Vault@2024  (MANAGER)")
        print("  auditor@assetvault.uz / Vault@2024  (AUDITOR)")

    except Exception as e:
        session.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed()
