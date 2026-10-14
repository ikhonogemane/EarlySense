from rest_framework import status
from rest_framework.test import APITestCase

from .models import User


class UserRoleEscalationTests(APITestCase):
    """
    FR02, NFR16 - only a System Administrator may change a user's role
    or active status. See docs/gap-analysis.md, section 6, item 3.
    """

    def setUp(self):
        self.educator = User.objects.create_user(
            username='educator1',
            email='educator1@example.com',
            password='testpass123',
            full_name='Test Educator',
            role='Educator',
        )
        self.admin = User.objects.create_user(
            username='admin1',
            email='admin1@example.com',
            password='testpass123',
            full_name='Test Admin',
            role='System_Admin',
        )

    def test_educator_cannot_change_own_role(self):
        self.client.force_authenticate(user=self.educator)
        response = self.client.patch(
            f'/api/users/{self.educator.id}/',
            {'role': 'System_Admin'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.educator.refresh_from_db()
        self.assertEqual(self.educator.role, 'Educator')

    def test_educator_cannot_deactivate_self(self):
        self.client.force_authenticate(user=self.educator)
        response = self.client.patch(
            f'/api/users/{self.educator.id}/',
            {'is_active': False},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.educator.refresh_from_db()
        self.assertTrue(self.educator.is_active)

    def test_system_admin_can_change_another_users_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/users/{self.educator.id}/',
            {'role': 'LST_Member'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.educator.refresh_from_db()
        self.assertEqual(self.educator.role, 'LST_Member')
