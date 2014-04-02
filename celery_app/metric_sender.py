"""Send Metrics via a Vumi Go HTTP API."""

import json
import logging

import requests

from django.conf import settings


class MetricSetupError(Exception):
    """Raised when creating an Metric sender fails."""


class MetricSendingError(Exception):
    """Raised when Metric sending fails."""


class MetricSender(object):
    def __init__(self):
        """Override in sub-classes."""
        pass

    def fire(self, metric, value, agg):
        """Fires a metric.

            Arguments:  
            metric (string) - the name of the metric
            value (number) - the value of the metric
            agg (string) - the aggregation method to use
        """
        raise NotImplementedError


class VumiGoSender(MetricSender):
    def __init__(self, api_url, account_id, conversation_id,
                 conversation_token):
        self.api_url = api_url
        self.account_id = account_id
        self.conversation_id = conversation_id
        self.conversation_token = conversation_token

    def _api_url(self):
        return "%s/%s/metrics.json" % (self.api_url, self.conversation_id)

    def fire(self, metric, value, agg):
        headers = {'content-type': 'application/json; charset=utf-8'}
        payload = [
            [
                metric,
                value,
                agg
            ]
        ]
        response = requests.put(self._api_url(), auth=(self.account_id, self.conversation_token), headers=headers, data=json.dumps(payload))

        if response.status_code != requests.codes.ok:
            raise MetricSendingError("Failed to fire metric, response code: %d,"
                                  " data: %r" % (response.status_code,
                                                 response.content))
        try:
            reply = response.json()
        except ValueError:
            raise MetricSendingError("Bad response received from Vumi Go"
                                  " HTTP API. Expected JSON, received:"
                                  " %r" % (response.content,))
        return reply


class LoggingSender(MetricSender):
    def __init__(self, logger="celery_app.metric_sender", level=logging.INFO):
        self._logger = logging.getLogger(logger)
        self._level = level

    def fire(self, metric, value, agg):
        print "Metric %r: %r (%r)" % (metric, value, agg)
        self._logger.log(self._level, "Metric %r: %r (%r)" % (metric, value, agg))


def create_sender(metric_config):
    """Factory for creating an metric sender from settings.

       Update this is you want to add new sender types.
       """
    if metric_config is None:
        raise MetricSetupError("Metric sending not configured."
                            " Set METRIC_SETTINGS in settings.py")
    sender_type = metric_config.pop('sender_type', None)
    if sender_type is None:
        raise MetricSetupError("METRIC_SETTINGS contains no sender_type")
    senders = {
        "vumigo": VumiGoSender,
        "logging": LoggingSender,
    }
    sender_cls = senders.get(sender_type)
    if sender_cls is None:
        raise MetricSetupError("Unknown sender_type %r. Available types"
                            " are: %s" % (sender_type, senders.keys()))
    return sender_cls(**metric_config)

default_sender = create_sender(getattr(settings, 'METRIC_SETTINGS', None))
fire = default_sender.fire
