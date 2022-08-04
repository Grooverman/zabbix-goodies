#!/usr/bin/env python3
import json
import yaml
import datetime
from pprint import pformat
from pyzabbix import ZabbixAPI
from config import *

# call api
zapi = ZabbixAPI(
        url=REMOTE_ZABBIX_URL,
        user=REMOTE_ZABBIX_USER,
        password=REMOTE_ZABBIX_PASSWORD)
zapi_output = zapi.problem.get(
        sortfield=["eventid"],
        selectTags='extend',
        output=["clock", "objectid", "name", "severity"])

for i in zapi_output:
    i['responsible'] = ''
    i['service'] = ''
    for t in i['tags']:
        tag = t['tag']
        value = t['value']
        try:
            if tag == 'Responsible':
                i.update({'responsible': value})
            if tag == 'Service':
                i.update({'service': value})
        except:
            pass
    del i['tags']

#print(yaml.dump(zapi_output))
#print(json.dumps(zapi_output))
#exit()

# make list of eventids
eventids = []
for i in zapi_output:
    eventids.append(i['eventid'])

# get hosts for each eventid
zapi_events_host = zapi.event.get(
        selectHosts=['hostid', 'host'],
        eventids=eventids,
        output='eventid')

# make dictionary of events
events = {}
for i in zapi_output:
    events[i['eventid']] = i

# make list with combined hostid - eventid
hostid_eventid_list = []
for i in zapi_events_host:
    for h in i['hosts']:
        host_event_id = i['eventid'] + '-' + h['hostid']
        event = events[i['eventid']]
        event['hostid'] = h['hostid']
        event['host'] = h['host']
        event['date'] = str(datetime.datetime.fromtimestamp(int(event['clock'])))
        e = {host_event_id: event}
        hostid_eventid_list.append(e)

# print in csv format
print('¨eventid¨, ¨clock¨, ¨objectid¨, ¨name¨, ¨severity¨, ¨responsible¨, ¨service¨, ¨hostid¨, ¨host¨, ¨date¨')
for i in hostid_eventid_list:
    v = ''
    event_with_host = [v for k,v in i.items()][0]
    for key, value in event_with_host.items():
        v += '¨' + value + '¨, '
    print(v)
exit()

