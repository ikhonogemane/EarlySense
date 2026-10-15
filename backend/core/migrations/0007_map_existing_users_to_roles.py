# FR02, NFR17, NFR18 - phase (b) of the role migration in
# docs/gap-analysis.md. Maps every existing user's old, single `role`
# value to the new many-to-many Role(s) it becomes, carrying their
# assigned_grade/assigned_class_group over as the new UserRole's scope.
#
# Educator maps to BOTH Register Teacher and Subject Teacher: nothing in
# the old data distinguishes which of a teacher's classes they're the
# register teacher for vs. just a subject teacher in, so granting both is
# the only option that doesn't silently revoke access an Educator already
# has today.
#
# This mapping table is intentionally a self-contained copy, not an import
# from core.models - migrations must not depend on the live app's current
# code, since that code will keep changing after this migration is frozen
# in history. core.models.LEGACY_ROLE_MAP/sync_user_roles_from_legacy is
# the same mapping, used going forward by UserManager.create_superuser and
# (from phase (c1) onward) the /users/ create/update dual-write.
from django.db import migrations


LEGACY_ROLE_MAP = {
    "System_Admin": ["System Administrator"],
    "School_Admin": ["School Clerk"],
    "LST_Member": ["Wellness Office"],
    "Educator": ["Register Teacher", "Subject Teacher"],
}


def map_existing_users(apps, schema_editor):
    User = apps.get_model('core', 'User')
    Role = apps.get_model('core', 'Role')
    UserRole = apps.get_model('core', 'UserRole')

    for user in User.objects.all():
        for role_name in LEGACY_ROLE_MAP.get(user.role, []):
            role = Role.objects.get(name=role_name)
            UserRole.objects.get_or_create(
                user=user,
                role=role,
                grade_scope=user.assigned_grade,
                class_scope=user.assigned_class_group,
            )


def unmap_existing_users(apps, schema_editor):
    User = apps.get_model('core', 'User')
    Role = apps.get_model('core', 'Role')
    UserRole = apps.get_model('core', 'UserRole')

    for user in User.objects.all():
        for role_name in LEGACY_ROLE_MAP.get(user.role, []):
            role = Role.objects.get(name=role_name)
            UserRole.objects.filter(
                user=user,
                role=role,
                grade_scope=user.assigned_grade,
                class_scope=user.assigned_class_group,
            ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_seed_roles'),
    ]

    operations = [
        migrations.RunPython(map_existing_users, unmap_existing_users),
    ]
