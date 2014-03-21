# Django imports
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.test import TestCase


class TestUploadCSV(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('test', 'test@example.com', "pass123")

    def test_upload_view_not_logged_in_blocked(self):
        response = self.client.post(reverse("csv_uploader"))
        self.assertEqual(response.template_name, "admin/login.html")

    def test_upload_view_logged_in(self):
        self.client.login(username="test", password="pass123")

        response = self.client.post(reverse("csv_uploader"))
        self.assertIn("Upload CSV", response.content)
