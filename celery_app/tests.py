# Django imports
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.utils.timezone import utc
from django.test import TestCase
from django.test.utils import override_settings
from StringIO import StringIO
from datetime import datetime

from celery_app.tasks import ingest_csv, sum_and_fire_facebook
from metrics_manager.models import Channel, IncomingData, MetricSummary


class TestUploadCSV(TestCase):

    M_SEP = ("sep=,\r\n")
    M_HEADER = (
        "ID,Date,UserID,Nick,\"Mxit Email\",\"Enter your name\",\"Name & Surname\","
        "Mobile,\"Enter your mobile number\",\"Enter your email address (optional). "
        "Don't have an email address? Use your mxit address (mxitid@mxit.im)\"\r\n")
    M_LINE_CLEAN_1 = (
        "53076459416da19a230000f9,\"2014-02-21 16:36:09\",m0000000001,NICK1,"
        "nick1@mxit.im,First,,,0845000001,NICK1\r\n")
    M_LINE_CLEAN_2 = (
        "530794f8426da1fe0c000040,\"2014-02-21 20:03:36\",m0000000002,NICK2,"
        "nick2@mxit.im,\"Second Name\",,,0845000002,nick2@mxit.im\r\n")
    M_LINE_DIRTY_1 = (
        "53085354426da1ba36000086,\"2014-02-22 09:35:48\",m0000000003,NICK3,"
        "nick3@mxit.im\r\n")

    E_HEADER = ("Date,\"First name:\",\"Second name:\",Email:,\"Mobile number:\""
                ",age,city,gender\r\n")
    E_LINE_CLEAN_1 = ("2014-02-17,Idris,Ibrahim,user1@eskimi.com,"
                      "2311111111111,21,Okene,male\r\n")
    E_LINE_CLEAN_2 = ("2014-02-17,yemi,ade,user2@eskimi.com,"
                      "2322222222222,27,Ibadan,male\r\n")
    E_LINE_DIRTY_1 = ("2014-02-17,yemi,ade,user3@eskimi.com\r\n")

    B_HEADER = ("Date,Country,City,SurveyUserId,\"I agree that AIDS, TB and malaria "
                "are all preventable and treatable  yet together they still kill more "
                "than 2 million Africans each year. I agree that spending promises through "
                "clear and open health budgets need to be upheld so these deaths can be avoided.\","
                "Please enter your full name.,Account ID,User Name,Age,Sex,Relationship Status,"
                "Education Level,Employment Status,Num Children\r\n")

    B_LINE_CLEAN_1 = ("2013-07-28,UG,Kampala,111111,Yes,User One,1111111,User01,"
                      "24,M,Single,College,Student,0\r\n")
    B_LINE_CLEAN_2 = ("2013-07-28,ZW,Bindura,111112,Yes,User Two,2222222,User02,"
                      "23,F,Engaged,College,Self-employed,0\r\n")
    B_LINE_DIRTY_1 = ("2013-07-28,ZW,Bindura,111113,Yes,User Three\r\n")

    fixtures = ["channel.json"]

    def setUp(self):
        self.admin = User.objects.create_superuser(
            'test', 'test@example.com', "pass123")

    def test_upload_view_not_logged_in_blocked(self):
        response = self.client.post(reverse("csv_uploader"))
        self.assertEqual(response.template_name, "admin/login.html")

    def test_upload_view_logged_in(self):
        self.client.login(username="test", password="pass123")

        response = self.client.post(reverse("csv_uploader"))
        self.assertIn("Upload CSV", response.content)

    def test_upload_mxit_clean(self):
        channel = Channel.objects.get(name="mxit")
        clean_sample =  self.M_SEP + self.M_HEADER + \
            self.M_LINE_CLEAN_1 + self.M_LINE_CLEAN_2
        uploaded = StringIO(clean_sample)
        ingest_csv(uploaded, channel, "za")
        imported = IncomingData.objects.get(channel_uid="m0000000002")
        self.assertEquals(imported.email, "nick2@mxit.im")
        self.assertEquals(imported.source_timestamp,
                          datetime(2014, 2, 21, 20, 3, 36, tzinfo=utc))
        self.assertEquals(imported.name, "Second Name")
        self.assertEquals(imported.channel_uid, "m0000000002")
        self.assertEquals(imported.msisdn, "0845000002")

    def test_upload_mxit_dirty(self):
        channel = Channel.objects.get(name="mxit")
        dirty_sample =  self.M_SEP + self.M_HEADER + \
            self.M_LINE_CLEAN_1 + self.M_LINE_DIRTY_1
        uploaded = StringIO(dirty_sample)
        ingest_csv(uploaded, channel, "za")
        self.assertRaises(IncomingData.DoesNotExist,
                          lambda:  IncomingData.objects.get(channel_uid="m00000000003"))

    def test_upload_eskimi_clean(self):
        channel = Channel.objects.get(name="eskimi")
        clean_sample =  self.E_HEADER + self.E_LINE_CLEAN_1 + \
            self.E_LINE_CLEAN_2
        uploaded = StringIO(clean_sample)
        ingest_csv(uploaded, channel, "za")
        imported = IncomingData.objects.get(channel_uid="2311111111111")
        self.assertEquals(imported.email, "user1@eskimi.com")
        self.assertEquals(imported.source_timestamp,
                          datetime(2014, 2, 17, tzinfo=utc))
        self.assertEquals(imported.name, "Idris Ibrahim")
        self.assertEquals(imported.channel_uid, "2311111111111")
        self.assertEquals(imported.msisdn, "2311111111111")

    def test_upload_eskimi_dirty(self):
        channel = Channel.objects.get(name="eskimi")
        dirty_sample =  self.E_HEADER + self.E_LINE_CLEAN_1 + \
            self.E_LINE_DIRTY_1
        uploaded = StringIO(dirty_sample)
        ingest_csv(uploaded, channel, "za")
        self.assertRaises(IncomingData.DoesNotExist,
                          lambda:  IncomingData.objects.get(channel_uid="233333333333"))

    def test_upload_binu_clean(self):
        channel = Channel.objects.get(name="binu")
        clean_sample =  self.B_HEADER + self.B_LINE_CLEAN_1 + \
            self.B_LINE_CLEAN_2
        uploaded = StringIO(clean_sample)
        ingest_csv(uploaded, channel, "za")
        imported = IncomingData.objects.get(channel_uid="1111111")
        self.assertEquals(imported.name, "User One")
        self.assertEquals(imported.source_timestamp,
                          datetime(2013, 7, 28, tzinfo=utc))
        self.assertEquals(imported.channel_uid, "1111111")
        self.assertEquals(imported.age, "24")

    def test_upload_binu_dirty(self):
        channel = Channel.objects.get(name="binu")
        dirty_sample =  self.B_HEADER + self.B_LINE_CLEAN_1 + \
            self.B_LINE_DIRTY_1
        uploaded = StringIO(dirty_sample)
        ingest_csv(uploaded, channel, "za")
        self.assertRaises(IncomingData.DoesNotExist,
                          lambda:  IncomingData.objects.get(channel_uid="3333333"))

    def test_metric_fires(self):
        channel = Channel.objects.get(name="facebook")
        metric = MetricSummary.objects.filter(channel=channel)[0]
        metric.total = 100
        metric.save()
        result = sum_and_fire_facebook.delay()
        self.assertTrue(result.successful())
        self.assertEquals(result.get()["global.facebook.supporter"],
                          "Metric 'global.facebook.supporter': 100 ('MAX')")
        self.assertEquals(result.get()["supporter"],
                          "Metric 'supporter': 100 ('MAX')")

    def test_mxit_metric_fires(self):
        channel = Channel.objects.get(name="mxit")
        clean_sample =  self.M_SEP + self.M_HEADER + \
            self.M_LINE_CLEAN_1 + self.M_LINE_CLEAN_2
        uploaded = StringIO(clean_sample)
        result = ingest_csv(uploaded, channel, "za")
        self.assertTrue(result.successful())
        self.assertEquals(result.get()["za.mxit.supporter"],
                          "Metric 'za.mxit.supporter': 2 ('MAX')")
        self.assertEquals(result.get()["supporter"],
                          "Metric 'supporter': 2 ('MAX')")
