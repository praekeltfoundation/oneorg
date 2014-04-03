from celery import task
import csv
from metrics_manager.models import IncomingData, MetricSummary, Channel
from celery_app.metric_sender import fire
import iso8601
from django.db import IntegrityError, transaction
from django.db.models import Sum
import logging
logger = logging.getLogger(__name__)


@task()
@transaction.atomic
def ingest_csv(csv_data, channel, default_country_code):
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
                incoming_data.source_timestamp = iso8601.parse_date(
                    line["Date"])
                incoming_data.channel = channel
                incoming_data.channel_uid = line["UserID"][:254]
                if line["Enter your email address (optional). Don't have an email address? Use your mxit address (mxitid@mxit.im)"] is None:
                    incoming_data.email = line["Mxit Email"][:254]
                else:
                    incoming_data.email = line["Enter your email address (optional). Don't have an email address? Use your mxit address (mxitid@mxit.im)"][:254]
                if line["Enter your name"] is not None:
                    incoming_data.name = line["Enter your name"][:254]
                if line["Enter your mobile number"] is not None:
                    incoming_data.msisdn = line["Enter your mobile number"][:99]
                incoming_data.country_code = default_country_code
                incoming_data.save()
            except IntegrityError as e:
                incoming_data = None
                # crappy CSV data
                print 
                logger.error(e)
        return sum_and_fire.delay(channel)  # send metrics
    elif channel.name == "eskimi":
        records = csv.DictReader(csv_data)
        for line in records:
            try:
                incoming_data = IncomingData()
                incoming_data.source_timestamp = iso8601.parse_date(
                    line["Date"])
                incoming_data.channel = channel
                incoming_data.channel_uid = line["Mobile number:"]
                incoming_data.email = line["Email:"]
                incoming_data.name = line["First name:"] + \
                    " " + line["Second name:"]
                incoming_data.msisdn = line["Mobile number:"]
                if line["age"] != "yimi":
                    incoming_data.age = line["age"]
                incoming_data.country_code = default_country_code
                incoming_data.location = line["city"]
                incoming_data.gender = line["gender"]
                incoming_data.save()
            except IntegrityError as e:
                incoming_data = None
                # crappy CSV data
                logger.error(e)
        return sum_and_fire.delay(channel)  # send metrics
    elif channel.name == "binu":
        records = csv.DictReader(csv_data)
        for line in records:
            try:
                incoming_data = IncomingData()
                incoming_data.source_timestamp = iso8601.parse_date(
                    line["Date"])
                incoming_data.channel = channel
                incoming_data.channel_uid = line["Account ID"]
                incoming_data.name = line["Please enter your full name."]
                incoming_data.age = line["Age"]
                if "Country" in line and line["Country"] is not None:
                    incoming_data.country_code = line["Country"]
                else:
                    incoming_data.country_code = default_country_code
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
        return sum_and_fire.delay(channel)  # send metrics


@task()
def sum_and_fire(channel):
    """ When a channel is updated a number of metrics needs sending to Vumi """
    response = {}
    metrics = MetricSummary.objects.filter(channel=channel).all()
    extras = {
        "supporter": 0,
        "global.supporter": 0,
        "za.supporter": 0,
        "ng.supporter": 0,
        "tz.supporter": 0
    }
    for metric in metrics:
        total = IncomingData.objects.filter(channel=channel).filter(
            country_code=metric.country_code).count()
        extras["supporter"] += total
        extras[metric.country_code + ".supporter"] += total
        metric_name = "%s.%s.%s" % (
            str(metric.country_code), str(metric.channel.name), str(metric.metric))
        if total is not 0:
            response[metric_name] = fire(metric_name, total, "MAX")
        metric.total = total
        metric.save()
    for extra, value in extras.iteritems():
        if value is not 0:
            response[extra] = fire(extra, value, "MAX")
    return response

@task()
def sum_and_fire_facebook():
    response = {}
    channel = Channel.objects.filter(name="facebook")[0]
    metric = MetricSummary.objects.filter(channel=channel)[0]
    metric_name = "%s.%s.%s" % (
            str(metric.country_code), str(metric.channel.name), str(metric.metric))
    response[metric_name] = fire(metric_name, metric.total, "MAX")  # send metrics
    total_supporters = MetricSummary.objects.aggregate(total=Sum('total'))
    response["supporter"] = fire("supporter", total_supporters["total"], "MAX")  # send metrics
    return response
