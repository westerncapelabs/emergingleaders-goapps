module.exports = function() {
return [

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
    }
];
};
