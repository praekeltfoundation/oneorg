from celery import task
import csv
from metrics_manager.models import IncomingData
from dateutil import parser


@task()
def ingest_csv(csv_data, channel):
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
    records = csv.reader(csv_data, delimiter=',', quotechar='"')
    if channel.name == "mxit":
        for line in records:
            if len(line) > 6 and line != headers["mxit"]: 
                incoming_data = IncomingData()
                incoming_data.source_timestamp = parser.parse(line[0] + " UTC")
                incoming_data.channel = channel
                incoming_data.channel_uid = line[1]
                incoming_data.email = line[3]
                incoming_data.name = line[4]
                incoming_data.msisdn = line[5]
                # Country in header but not sample data we have
                if len(line) == 8 and line[7] != "":
                    incoming_data.country_code = line[7]
                incoming_data.save()
    elif channel.name == "eskimi":
        for line in records:
            if len(line) > 6 and line != headers["eskimi"]:
                incoming_data = IncomingData()
                incoming_data.source_timestamp = parser.parse(line[0] +" 00:00:00 UTC")
                incoming_data.channel = channel
                incoming_data.channel_uid = line[4]
                incoming_data.email = line[3]
                incoming_data.name = line[1] + " " + line[2]
                incoming_data.msisdn = line[4]
                if line[5] != "yimi":
                    incoming_data.age = line[5]
                incoming_data.location = line[6]
                incoming_data.gender = line[7]
                incoming_data.save()
    elif channel.name == "binu":
        for line in records:
            if len(line) > 6 and line != headers["binu"]:
                incoming_data = IncomingData()
                incoming_data.source_timestamp = parser.parse(line[0] +" 00:00:00 UTC")
                incoming_data.channel = channel
                incoming_data.channel_uid = line[6]
                incoming_data.name = line[5]
                incoming_data.age = line[8]
                incoming_data.country_code = line[1]
                incoming_data.location = line[2]
                if line[8] == "M":
                    incoming_data.gender = "male"
                else:
                    incoming_data.gender = "female"
                incoming_data.save()
