#!/usr/bin/env python3
from pyzabbix import ZabbixAPI
from config import *

# call api
zapi = ZabbixAPI(
        url=REMOTE_ZABBIX_URL,
        user=REMOTE_ZABBIX_USER,
        password=REMOTE_ZABBIX_PASSWORD)
hosts = zapi.host.get(
        monitored_hosts=True,
        with_monitored_triggers=True,
        selectHttpTests=True,
        selectTags='extend',
        output=['host', 'httpTests'])

# print csv
print('host' + ';' + 'hostid' + ';' + 'responsible' + ';' + 'service')
for i in hosts:
    responsible = ''
    service = ''
    try:
        for t in i['tags']:
            if t['tag'] == 'Responsible':
                responsible = t['value']
            if t['tag'] == 'Service':
                service = t['value']
    except:
        pass
    print(i['host'] + ';' + i['hostid'] + ';' + responsible + ';' + service)

exit()
