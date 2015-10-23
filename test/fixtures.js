module.exports = function() {
return [

// TRAINING CODE VALIDATION

    // Validate training code 111
    {
        "request": {
            "method": "GET",
            "url": "http://127.0.0.1:8000/api/v1/events/111/"
        },
        "response": {
            "status_code": 200,
            "data": {
                "url": "http://127.0.0.1:8000/api/v1/events/111/",
                "id": 111,
                "trainer": "http://127.0.0.1:8000/api/v1/trainers/1/",
                "location": "http://127.0.0.1:8000/api/v1/locations/1/",
                "scheduled_at": "2015-10-22T16:00:00Z"
            }
        }
    },

    // Validate training code 222
    {
        "request": {
            "method": "GET",
            "url": "http://127.0.0.1:8000/api/v1/events/222/"
        },
        "response": {
            "status_code": 200,
            "data": {
                "url": "http://127.0.0.1:8000/api/v1/events/222/",
                "id": 222,
                "trainer": "http://127.0.0.1:8000/api/v1/trainers/1/",
                "location": "http://127.0.0.1:8000/api/v1/locations/1/",
                "scheduled_at": "2015-10-22T16:00:00Z"
            }
        }
    },

    // Validate training code 999 - doesn't exist
    {
        "request": {
            "method": "GET",
            "url": "http://127.0.0.1:8000/api/v1/events/999/"
        },
        "response": {
            "code": 404,
            "data": {}
        }
    },


// GET PARTICIPANT BY MSISDN

    // get participant 082111 - does not exist
    {
        'request': {
            'method': 'GET',
            'params': {
                'msisdn': '+082111'
            },
            'url': 'http://127.0.0.1:8000/api/v1/participants/',
        },
        'response': {
            "code": 200,
            "data": {
                "count": 0,
                "next": null,
                "previous": null,
                "results": []
            }
        }
    },

    // get participant 082222 - exists
    {
        'request': {
            'method': 'GET',
            'params': {
                'msisdn': '+082222'
            },
            'url': 'http://127.0.0.1:8000/api/v1/participants/',
        },
        'response': {
            "code": 200,
            "data": {
                "count": 1,
                "next": null,
                "previous": null,
                "results": [{
                    "url": "http://localhost:8000/api/v1/participants/22/",
                    "id": 222,
                    "msisdn": "+082222",
                    "lang": "af",
                    "full_name": "Pete Pompey",
                    "gender": "male",
                    "id_type": "sa_id",
                    "id_no": "5101025009086",
                    "dob": '1951-01-02',
                    "passport_origin": null
                }]
            }
        }
    },


// POST CREATE PARTICIPANT

    // post create participant 082111
    {
        'request': {
            'method': 'POST',
            'url': 'http://127.0.0.1:8000/api/v1/participants/',
            'data': {
                'msisdn': '+082111'
            },
        },
        'response': {
            "code": 201,
            "data": {
                "url": "http://localhost:8000/api/v1/participants/111/",
                "id": 111,
                "msisdn": "+082111",
                "lang": null,
                "full_name": null,
                "gender": null,
                "id_type": null,
                "id_no": null,
                "dob": null,
                "passport_origin": null
            }
        }
    },


// POST ATTENDEES

    // post attendee 111
    {
        "request": {
            "method": "POST",
            "url": "http://127.0.0.1:8000/api/v1/attendees/",
            "data": {
                "event":"/api/v1/events/111/",
                "participant":"/api/v1/participants/111/"
            }
        },
        "response": {
            "code": 201,
            "data": {
                "url": "http://localhost:8000/api/v1/attendees/111/",
                "id": 111,
                "event": "http://localhost:8000/api/v1/events/111/",
                "participant": "http://localhost:8000/api/v1/participants/111/",
                "survey_sent": false
            }
        }
    },

    // post attendee 222
    {
        "request": {
            "method": "POST",
            "url": "http://127.0.0.1:8000/api/v1/attendees/",
            "data": {
                "event":"/api/v1/events/222/",
                "participant":"/api/v1/participants/222/"
            }
        },
        "response": {
            "code": 201,
            "data": {
                "url": "http://localhost:8000/api/v1/attendees/222/",
                "id": 222,
                "event": "http://localhost:8000/api/v1/events/222/",
                "participant": "http://localhost:8000/api/v1/participants/222/",
                "survey_sent": false
            }
        }
    },

];
};
