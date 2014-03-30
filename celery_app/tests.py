# Django imports
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.utils.timezone import utc
from django.test import TestCase
from StringIO import StringIO
from datetime import datetime

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
    M_LINE_DIRTY_1 = ("\"2014-02-04 12:35:34\",m00000000004\r\n")

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
        imported = IncomingData.objects.get(channel_uid="m00000000002")
        self.assertEquals(imported.email, "user2@mxit.im")
        self.assertEquals(imported.source_timestamp, datetime(2014, 2, 4, 12, 35, 34, tzinfo=utc))
        self.assertEquals(imported.name, "Malefa tshabalala")
        self.assertEquals(imported.channel_uid, "m00000000002")
        self.assertEquals(imported.msisdn, "0700000002")
        
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
        self.assertEquals(imported.source_timestamp, datetime(2014, 2, 17, tzinfo=utc))
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
        self.assertEquals(imported.source_timestamp, datetime(2013, 7, 28, tzinfo=utc))
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
