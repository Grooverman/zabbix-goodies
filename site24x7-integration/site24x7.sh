#!/bin/bash

# get configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
CONFIG_FILE=$SCRIPT_DIR/config.ini
source <(grep = $CONFIG_FILE | sed 's/ *= */=/g' | sed "s/;/#/g")

# get refresh token if grant token provided
function get_refresh_token () {
	curl -s $auth_url \
		-X POST \
		-d "client_id=$client_id" \
		-d "client_secret=$client_secret" \
		-d "code=$grant_token" \
		-d "grant_type=authorization_code"
}
if [ -n "$grant_token" ]; then
	json=$(get_refresh_token)
	refresh_token=$(echo $json | jq -r '.refresh_token')
	access_token=$(echo $json | jq -r '.access_token')
	if [ -n "$access_token" ] && [ "$access_token" != "null" ]; then
		echo `date +"%m-%d %H:%M:%S"` 'Got new "refresh" token, and "access" token.'
		cred=$CONFIG_FILE
		sed -i "s/^refresh_token=.*\$/refresh_token=$refresh_token/" $cred
		sed -i 's/^grant_token=.*/grant_token=/' $cred
	else
		echo Something went wrong.; exit 125
	fi
else
	# get new access token
	access_token=$(curl -s $auth_url \
		-X POST \
		-d "client_id=$client_id" \
		-d "client_secret=$client_secret" \
		-d "refresh_token=$refresh_token" \
		-d "grant_type=refresh_token" | jq -r '.access_token')
	if [ -n "$access_token" ] && [ "$access_token" != "null" ]; then
		echo `date +"%m-%d %H:%M:%S"` 'Got new "access" token.'
	else
		echo Something went wrong.; exit 125
	fi
fi

# process monitors data
function get_current_status () {
	curl -s -G $api_url/current_status \
		-d "status_required=0,1,2,3,5,7,10" \
		-d "group_required=false" \
		-H "Authorization: Zoho-oauthtoken $access_token"
}
monitors=$(get_current_status | jq '.data.monitors')

# send discovery data, or statuses, or show data
function discover () {
	echo `date +"%m-%d %H:%M:%S"` Sending discovery data...
	echo \"$zabbix_host_name\" $zabbix_discovery_key $monitors \
		| $SCRIPT_DIR/zabbix_sender -vv -z $zabbix_server -i -
}
function send_status_data () {
	echo `date +"%m-%d %H:%M:%S"` Sending monitor status data...
	jq_command='.[] |
		[
			$zh, 
			(
				.monitor_id | 
					sub( "^(?<id>.*)"; $zk + "[\"" + .id + "\"]" )
			), 
			.status
		] | join(" ")'
	echo $monitors | jq -r -c \
		--arg zh "\"$zabbix_host_name\"" \
		--arg zk $zabbix_item_key \
		"$jq_command" \
		| $SCRIPT_DIR/zabbix_sender -vv -z $zabbix_server -i -
}
if [[ "$1" == "discovery" ]]; then
	discover
elif [[ "$1" == "poll" ]]; then
	send_status_data
elif [[ "$1" == "show" ]]; then
	echo $monitors | jq
else
	discover
	send_status_data
fi

