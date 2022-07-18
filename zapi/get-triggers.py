#!/usr/bin/env python3
import json
import yaml
from pprint import pformat
from pyzabbix import ZabbixAPI
from config import *


# call api
zapi = ZabbixAPI(
        url=REMOTE_ZABBIX_URL,
        user=REMOTE_ZABBIX_USER,
        password=REMOTE_ZABBIX_PASSWORD)
hosts_with_triggers = zapi.host.get(
        search='%%',
        monitored_hosts=True,
        with_items=True,
        with_monitored_triggers=True,
        selectTriggers=["triggerid", "description"],
        output=['host'])

#print(json.dumps(zapi_get))
#print(yaml.dump(zapi_get))
print('¨hostid¨; ¨host¨; ¨triggerid¨; ¨description¨')
for h in hosts_with_triggers:
    for t in h['triggers']:
        print(
                '¨' + h['hostid'] + 
                '¨; ¨' + h['host'] + 
                '¨; ¨' + t['triggerid'] + 
                '¨; ¨' + t['description'] + 
                '¨')

exit()


