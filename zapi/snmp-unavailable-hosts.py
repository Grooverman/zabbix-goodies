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
hosts = zapi.host.get(
        groupids=[131, 146, 156],
        selectGroups='extend',
        filter={'snmp_available': 2, 'status': 0},
        selectInterfaces=["type"],
        output=['interfaces', 'host', 'status', 'groups'])

#print(json.dumps(hosts))
print(yaml.dump(hosts))
exit()

