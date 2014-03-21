from celery import task
import csv
from metrics_manager.models import IncomingData
from dateutil import parser


@task()
def ingest_csv(csv_data, channel):
    headers = {
        "mxit": ["Date", "UserID", "Nick", "Mxit Email", "Name & Surname", "Mobile",
            "Optional. email address - (Dont have an email address? Use your mxit address (mxitid@mxit.im)",
            "Country"]
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
