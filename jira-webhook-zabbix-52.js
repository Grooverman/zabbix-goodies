var Jira = {
    params: {},
    schema: {},

    setParams: function (params) {
        if (typeof params !== 'object') {
            return;
        }

        Jira.params = params;
        if (typeof Jira.params.url === 'string') {
            if (!Jira.params.url.endsWith('/')) {
                Jira.params.url += '/';
            }
        }
    },

    setProxy: function (HTTPProxy) {
        Jira.HTTPProxy = HTTPProxy;
    },

    setTags: function(event_tags_json) {
        if (!Jira.schema) {
            Zabbix.Log(4, '[ Jira Service Desk Webhook ] Cannot add labels because failed to retrieve field schema.');

            return;
        }

        var block = Jira.schema.requestTypeFields.filter(function(object) {
            return object.fieldId == 'labels';
        });

        if (block[0] && typeof event_tags_json !== 'undefined' && event_tags_json !== ''
            && event_tags_json !== '{EVENT.TAGSJSON}') {
            try {
                var tags = JSON.parse(event_tags_json),
                    label;

                Jira.labels = [];

                tags.forEach(function (tag) {
                    if (typeof tag.tag !== 'undefined' && typeof tag.value !== 'undefined' ) {
                        label = (tag.tag + (tag.value ? (':' + tag.value) : '')).replace(/\s/g, '_');
                        if (label.length < 255) {
                            Jira.labels.push(label);
                        }
                    }
                });
            }
            catch (error) {
                // Code is not missing here.
            }
        }
    },

    addCustomFields: function (data, fields) {
        if (typeof fields === 'object' && Object.keys(fields).length) {
            if (Jira.schema) {
                Object.keys(fields)
                    .forEach(function(field) {
                        data.requestFieldValues[field] = fields[field];

                        var block = Jira.schema.requestTypeFields.filter(function(object) {
                            return object.fieldId == field;
                        });

                        if (typeof block[0] === 'object' && typeof block[0].jiraSchema === 'object'
                            && (block[0].jiraSchema.type === 'number' || block[0].jiraSchema.type === 'datetime')) {
                            switch (block[0].jiraSchema.type) {
                                case 'number':
                                    data.requestFieldValues[field] = parseInt(fields[field]);
                                    break;

                                case 'datetime':
                                    if (fields[field].match(/\d+[.-]\d+[.-]\d+T\d+:\d+:\d+/) !== null) {
                                        data.requestFieldValues[field] = fields[field].replace(/\./g, '-');
                                    }
                                    else {
                                        delete data.requestFieldValues[field];
                                    }
                                    break;
                            }
                        }
                    });
            }
            else {
                Zabbix.Log(4, '[ Jira Service Desk Webhook ] Cannot add custom fields' +
                    'because failed to retrieve field schema.');
            }
        }

        return data;
    },

    request: function (method, query, data) {
        ['url', 'user', 'password', 'servicedesk_id', 'request_type_id'].forEach(function (field) {
            if (typeof Jira.params !== 'object' || typeof Jira.params[field] === 'undefined'
                || Jira.params[field] === '' ) {
                throw 'Required Jira param is not set: "' + field + '".';
            }
        });

        var response, request = new CurlHttpRequest();
        if (!query.endsWith('/transitions')) {
            var url = Jira.params.url + 'rest/servicedeskapi/' + query;
        } else {
            var url = Jira.params.url + 'rest/api/latest/' + query;
        }

        request.AddHeader('Content-Type: application/json');
        request.AddHeader('Authorization: Basic ' + btoa(Jira.params.user + ':' + Jira.params.password));
        request.AddHeader('X-ExperimentalApi: opt-in');

        if (typeof Jira.HTTPProxy !== 'undefined' && Jira.HTTPProxy !== '') {
            request.SetProxy(Jira.HTTPProxy);
        }

        if (typeof data !== 'undefined') {
            data = JSON.stringify(data);
        }

        Zabbix.Log(4, '[ Jira Service Desk Webhook ] Sending request: ' + url +
            ((typeof data === 'string') ? ('\n' + data) : ''));

        switch (method) {
            case 'get':
                response = request.Get(url, data);
                break;

            case 'post':
                response = request.Post(url, data);
                break;

            case 'put':
                response = request.Put(url, data);
                break;

            default:
                throw 'Unsupported HTTP request method: ' + method;
        }

        Zabbix.Log(4, '[ Jira Service Desk Webhook ] Received response with status code ' +
            request.Status() + '\n' + response);

        if (response !== null) {
            try {
                response = JSON.parse(response);
            }
            catch (error) {
                Zabbix.Log(4, '[ Jira Service Desk Webhook ] Failed to parse response received from Jira');
                response = null;
            }
        }

        if (request.Status() < 200 || request.Status() >= 300) {
            var message = 'Request failed with status code ' + request.Status();

            if (response !== null && typeof response.errors !== 'undefined'
                && Object.keys(response.errors).length > 0) {
                message += ': ' + JSON.stringify(response.errors);
            }
            else if (response !== null && typeof response.errorMessage !== 'undefined'
                && Object.keys(response.errorMessage).length > 0) {
                message += ': ' + JSON.stringify(response.errorMessage);
            }

            throw message + ' Check debug log for more information.';
        }

        return {
            status: request.Status(),
            response: response
        };
    },

    getSchema: function() {
        var result = Jira.request('get', 'servicedesk/' + Jira.params.servicedesk_id + '/requesttype/' +
            Jira.params.request_type_id + '/field');

        if (typeof Jira.schema !== 'object' && typeof Jira.schema.requestTypeFields !== 'object') {
            Jira.schema = null;
        }
        else {
            Jira.schema = result.response;
        }
    },

    createRequest: function(summary, description, fields) {
        var data = {
            serviceDeskId: Jira.params.servicedesk_id,
            requestTypeId: Jira.params.request_type_id,
            requestFieldValues: {
                summary: summary
            }
        };

        if (Jira.labels && Jira.labels.length > 0) {
            data.requestFieldValues.labels = Jira.labels;
        }
        var result = Jira.request('post', 'request', Jira.addCustomFields(data, fields));

        if (typeof result.response !== 'object' || typeof result.response.issueKey === 'undefined') {
            throw 'Cannot create Jira request. Check debug log for more information.';
        }

        return result.response.issueKey;
    }
};

try {
    var params = JSON.parse(value),
        fields = {},
        jira = {},
        comment = {public: true},
        result = {tags: {}},
        required_params = [
            'alert_subject', 'alert_message', 'event_source', 'event_value',
            'event_update_status', 'event_recovery_value'
        ];

    Object.keys(params)
        .forEach(function (key) {
            if (key.startsWith('jira_')) {
                jira[key.substring(5)] = params[key];
            }
            else if (key.startsWith('customfield_')) {
                fields[key] = params[key];
            }
            else if (required_params.indexOf(key) !== -1 && params[key] === '') {
                throw 'Parameter "' + key + '" cannot be empty.';
            }
        });

    if ([0, 1, 2, 3].indexOf(parseInt(params.event_source)) === -1) {
        throw 'Incorrect "event_source" parameter given: ' + params.event_source + '\nMust be 0-3.';
    }

    // Check {EVENT.VALUE} for trigger-based and internal events.
    if (params.event_value !== '0' && params.event_value !== '1'
        && (params.event_source === '0' || params.event_source === '3')) {
        throw 'Incorrect "event_value" parameter given: ' + params.event_value + '\nMust be 0 or 1.';
    }

    // Check {EVENT.UPDATE.STATUS} only for trigger-based events.
    if (params.event_update_status !== '0' && params.event_update_status !== '1' && params.event_source === '0') {
        throw 'Incorrect "event_update_status" parameter given: ' + params.event_update_status + '\nMust be 0 or 1.';
    }

    if (params.event_source !== '0' && params.event_recovery_value === '0') {
        throw 'Recovery operations are supported only for trigger-based actions.';
    }

    Jira.setParams(jira);
    Jira.setProxy(params.HTTPProxy);
    Jira.getSchema();
    Jira.setTags(params.event_tags_json);

    // Create request for non trigger-based events.
    if (params.event_source !== '0' && params.event_recovery_value !== '0') {
        Jira.createRequest(params.alert_subject, params.alert_message);
    }
    // Create request for trigger-based events.
    else if (params.event_value === '1' && params.event_update_status === '0'
        && jira.request_key === '{EVENT.TAGS.__zbx_jira_requestkey}') {
        var key = Jira.createRequest(params.alert_subject, params.alert_message, fields);

        result.tags.__zbx_jira_requestkey = key;
        result.tags.__zbx_jira_requestlink = params.jira_url +
            (params.jira_url.endsWith('/') ? '' : '/') + 'browse/' + key;
    }
    // Comment created request for trigger-based event.
    else {
        if (jira.request_key === '{EVENT.TAGS.__zbx_jira_requestkey}' || jira.request_key.trim() === '') {
            throw 'Incorrect Request key given: ' + jira.request_key;
        }
        comment.body = params.alert_message;
        Jira.request('post', 'request/' + Jira.params.request_key + '/comment', comment);

        // On recovery, set ticket to a different state, if specified.
        if (jira.recovery_transition_id) {
            var transitionData = {
                transition: {
                    id: jira.recovery_transition_id
                }
            };
            Jira.request('post', 'issue/' + Jira.params.request_key + '/transitions', transitionData);
        }
    }

    return JSON.stringify(result);
}
catch (error) {
    Zabbix.Log(3, '[ Jira Service Desk Webhook ] ERROR: ' + error);
    throw 'Sending failed: ' + error;
}
