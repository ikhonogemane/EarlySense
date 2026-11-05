"""
Run with: python create_demo_users.py
Creates one demo user for each of the six roles (FR02, NFR17, NFR18) so
EarlySense can be assessed role by role. Safe to run more than once: users
and their UserRole rows use get_or_create, so nothing is duplicated.

Every demo user shares DEMO_PASSWORD. Running the script again resets
that password and clears any account lockout on the demo users only.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from core.models import User, Role, UserRole

DEMO_PASSWORD = 'Demo@2026!'

# username, full name, legacy User.role, new role, grade scope, class scope.
# The legacy role field is still required by the User model; Grade Head has
# no legacy equivalent, so it is left blank (the same as existing Grade
# Head accounts). Class scopes match classes created by seed_data.py.
DEMO_USERS = [
    ('demo_clerk', 'Demo School Clerk', 'School_Admin', Role.SCHOOL_CLERK, None, None),
    ('demo_register', 'Demo Register Teacher', 'Educator', Role.REGISTER_TEACHER, 9, '9B'),
    ('demo_subject', 'Demo Subject Teacher', 'Educator', Role.SUBJECT_TEACHER, 10, '10A'),
    ('demo_gradehead', 'Demo Grade Head', '', Role.GRADE_HEAD, 9, None),
    ('demo_wellness', 'Demo Wellness Office', 'LST_Member', Role.WELLNESS_OFFICE, None, None),
    ('demo_admin', 'Demo System Administrator', 'System_Admin', Role.SYSTEM_ADMINISTRATOR, None, None),
]


def ensure_user(username, full_name, legacy_role, role_name, grade, class_group, password, reset_password):
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            'email': f'{username}@demo.earlysense.local',
            'full_name': full_name,
            'role': legacy_role,
            'assigned_grade': grade,
            'assigned_class_group': class_group,
        },
    )
    if created or reset_password:
        user.set_password(password)
        user.is_active = True
        user.failed_logins = 0
        user.locked_until = None
        user.save()

    role = Role.objects.get(name=role_name)
    _, role_created = UserRole.objects.get_or_create(
        user=user, role=role, grade_scope=grade, class_scope=class_group,
    )

    scope = class_group or (f'Grade {grade}' if grade else 'whole school')
    status = 'created' if created else 'exists'
    role_status = 'role added' if role_created else 'role exists'
    print(f"  {username:<16} {role_name:<22} {scope:<14} {status}, {role_status}")


with transaction.atomic():
    print("Creating demo users...")
    for username, full_name, legacy_role, role_name, grade, class_group in DEMO_USERS:
        ensure_user(username, full_name, legacy_role, role_name, grade, class_group,
                    DEMO_PASSWORD, reset_password=True)

    # seed_data.py records attendance, marks and incidents as 'ikho'. Only
    # create that user on a fresh database; an existing 'ikho' (and its
    # password) is never changed.
    print("Checking seed data user...")
    ensure_user('ikho', 'Ikho', 'System_Admin', Role.SYSTEM_ADMINISTRATOR, None, None,
                DEMO_PASSWORD, reset_password=False)

print(f"Done. Demo password for all demo users: {DEMO_PASSWORD}")
