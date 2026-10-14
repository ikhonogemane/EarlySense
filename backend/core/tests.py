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


class UserCreationPermissionTests(APITestCase):
    """
    FR02, NFR16 - only a System Administrator may create a user account
    via POST /api/users/. See docs/gap-analysis.md, section 6, item 3.
    """

    def setUp(self):
        self.educator = User.objects.create_user(
            username='educator2',
            email='educator2@example.com',
            password='testpass123',
            full_name='Another Educator',
            role='Educator',
        )
        self.admin = User.objects.create_user(
            username='admin2',
            email='admin2@example.com',
            password='testpass123',
            full_name='Another Admin',
            role='System_Admin',
        )

    def test_educator_cannot_create_system_admin_user(self):
        self.client.force_authenticate(user=self.educator)
        count_before = User.objects.count()
        response = self.client.post(
            '/api/users/',
            {
                'username': 'newadmin',
                'email': 'newadmin@example.com',
                'full_name': 'New Admin',
                'role': 'System_Admin',
                'password': 'testpass123',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(User.objects.count(), count_before)
        self.assertFalse(User.objects.filter(username='newadmin').exists())

    def test_system_admin_can_create_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            '/api/users/',
            {
                'username': 'newteacher',
                'email': 'newteacher@example.com',
                'full_name': 'New Teacher',
                'role': 'Educator',
                'password': 'testpass123',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newteacher').exists())
