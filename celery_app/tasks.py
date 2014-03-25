from celery import task
import csv
from metrics_manager.models import IncomingData
from dateutil import parser
from django.db import IntegrityError, transaction
import logging
logger = logging.getLogger(__name__)


@task()
@transaction.atomic
def ingest_csv(csv_data, channel):
    """ Expecting data in the following format:
    headers = {
        "mxit": ["Date", "UserID", "Nick", "Mxit Email", "Name & Surname", "Mobile",
            "Optional. email address - (Dont have an email address? Use your mxit address (mxitid@mxit.im)",
            "Country"],
        "eskimi": ["Date", "First name:", "Second name:", "Email:", "Mobile number:",
            "age", "city", "gender"],
        "binu": ["Date", "Country", "City", "SurveyUserId",
            "I agree that AIDS, TB and malaria are all preventable and treatable  yet together they still kill more than 2 million Africans each year. I agree that spending promises through clear and open health budgets need to be upheld so these deaths can be avoided.",
            "Please enter your full name.", "Account ID", "User Name", "Age", "Sex",
            "Relationship Status", "Education Level", "Employment Status", "Num Children"]
    }
    """

    if channel.name == "mxit":
        # Mxit has extra header
        csv_data.seek(0)
        next(csv_data)
        records = csv.DictReader(csv_data)
        for line in records:
            try:
                incoming_data = IncomingData()
                incoming_data.source_timestamp = parser.parse(
                    line["Date"] + " UTC")
                incoming_data.channel = channel
                incoming_data.channel_uid = line["UserID"]
                incoming_data.email = line["Mxit Email"]
                incoming_data.name = line["Name & Surname"]
                incoming_data.msisdn = line["Mobile"]
                # Country in header but not sample data we have
                if "Country" in line:
                    incoming_data.country_code = line["Country"]
                incoming_data.save()
            except IntegrityError as e:
                incoming_data = None
                # crappy CSV data
                logger.error(e)
    elif channel.name == "eskimi":
        records = csv.DictReader(csv_data)
        for line in records:
            try:
                incoming_data = IncomingData()
                incoming_data.source_timestamp = parser.parse(
                    line["Date"] + " 00:00:00 UTC")
                incoming_data.channel = channel
                incoming_data.channel_uid = line["Mobile number:"]
                incoming_data.email = line["Email:"]
                incoming_data.name = line["First name:"] + \
                    " " + line["Second name:"]
                incoming_data.msisdn = line["Mobile number:"]
                if line["age"] != "yimi":
                    incoming_data.age = line["age"]
                incoming_data.location = line["city"]
                incoming_data.gender = line["gender"]
                incoming_data.save()
            except IntegrityError as e:
                incoming_data = None
                # crappy CSV data
                logger.error(e)
    elif channel.name == "binu":
        records = csv.DictReader(csv_data)
        for line in records:
            try:
                incoming_data = IncomingData()
                incoming_data.source_timestamp = parser.parse(
                    line["Date"] + " 00:00:00 UTC")
                incoming_data.channel = channel
                incoming_data.channel_uid = line["Account ID"]
                incoming_data.name = line["Please enter your full name."]
                incoming_data.age = line["Age"]
                incoming_data.country_code = line["Country"]
                incoming_data.location = line["City"]
                if line["Sex"] == "M":
                    incoming_data.gender = "male"
                else:
                    incoming_data.gender = "female"
                incoming_data.save()
            except IntegrityError as e:
                incoming_data = None
                # crappy CSV data
                logger.error(e)
