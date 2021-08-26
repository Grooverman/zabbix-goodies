#!/bin/bash

# define urls
api_url="https://www.site24x7.com/api"
auth_url="https://accounts.zoho.com/oauth/v2/token"

# get credentials
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source $SCRIPT_DIR/credentials.ini

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
		echo 'Got new "refresh" token, and "access" token.'
		cred=$SCRIPT_DIR/credentials.ini
		sed -i "s/^refresh_token=.*\$/refresh_token=$refresh_token/" $cred
		sed -i 's/^grant_token=.*/grant_token=/' $cred
	else
		echo Something went wrong.
		exit
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
		echo 'Got new "access" token.'
	else
		echo Something went wrong.
		exit
	fi
fi

function get_current_status () {
	curl -s -G $api_url/current_status \
		-d "status_required=0,2,3,10" \
		-d "group_required=false" \
		-H "Authorization: Zoho-oauthtoken $access_token"
}

get_current_status | jq '.data.monitors'

