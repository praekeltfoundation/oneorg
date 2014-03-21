# Django imports
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.test import TestCase
from StringIO import StringIO

from celery_app.tasks import ingest_csv
from metrics_manager.models import Channel, IncomingData

class TestUploadCSV(TestCase):

    M_SEP = ("sep=,\r\n")
    M_HEADER = ("Date,UserID,Nick,\"Mxit Email\",\"Name & Surname\",Mobile,"
                "\"Optional. email address - (Dont have an email address? "
                "Use your mxit address (mxitid@mxit.im)\",Country\r\n")
    M_LINE_CLEAN_1 = ("\"2014-02-02 15:34:13\",m00000000001,User1,user1@mxit.im,"
                    "Joyclere,\"Hy guyz\",0700000001\r\n")
    M_LINE_CLEAN_2 = ("\"2014-02-04 12:35:34\",m00000000002,User2,user2@mxit.im,"
                    "\"Malefa tshabalala\",0700000002,user2@mxit.com\r\n")

    fixtures = ["channel.json"]
    def setUp(self):
        self.admin = User.objects.create_superuser('test', 'test@example.com', "pass123")

    def test_upload_view_not_logged_in_blocked(self):
        response = self.client.post(reverse("csv_uploader"))
        self.assertEqual(response.template_name, "admin/login.html")

    def test_upload_view_logged_in(self):
        self.client.login(username="test", password="pass123")

        response = self.client.post(reverse("csv_uploader"))
        self.assertIn("Upload CSV", response.content)

    def test_upload_mxit_clean(self):
        channel = Channel.objects.get(name="mxit")
        clean_sample =  self.M_SEP + self.M_HEADER + self.M_LINE_CLEAN_1 + self.M_LINE_CLEAN_2
        uploaded = StringIO(clean_sample)
        ingest_csv(uploaded, channel)
        imported = IncomingData.objects.get(channel_uid="m00000000002")
        self.assertEquals(imported.email, "user2@mxit.im")
