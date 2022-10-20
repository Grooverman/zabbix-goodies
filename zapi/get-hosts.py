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
#        search='%%',
        monitored_hosts=True,
        with_monitored_triggers=True,
        selectInterfaces=['ip'],
        output=['name', 'httpTests', 'triggers'])

print(json.dumps(hosts))
#print(yaml.dump(hosts))
exit()

