from django.db import migrations


ROLE_NAMES = [
    "Register Teacher",
    "Subject Teacher",
    "Grade Head",
    "School Clerk",
    "Wellness Office",
    "System Administrator",
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model("core", "Role")
    for name in ROLE_NAMES:
        Role.objects.get_or_create(name=name)


def remove_roles(apps, schema_editor):
    Role = apps.get_model("core", "Role")
    Role.objects.filter(name__in=ROLE_NAMES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_role_userrole'),
    ]

    operations = [
        migrations.RunPython(seed_roles, remove_roles),
    ]
