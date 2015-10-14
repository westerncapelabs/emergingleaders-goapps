module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.initConfig({
        paths: {
            src: {
                app: {
                    registration: 'src/registration.js',
                    feedback: 'src/feedback.js',
                    smsinbound: 'src/smsinbound.js'
                },
                registration: [
                    'src/index.js',
                    'src/utils.js',
                    '<%= paths.src.app.registration %>',
                    'src/init.js'
                ],
                feedback: [
                    'src/index.js',
                    'src/utils.js',
                    '<%= paths.src.app.feedback %>',
                    'src/init.js'
                ],
                smsinbound: [
                    'src/index.js',
                    'src/utils.js',
                    '<%= paths.src.app.smsinbound %>',
                    'src/init.js'
                ],
                all: [
                    'src/**/*.js'
                ]
            },
            dest: {
                registration: 'go-app-registration.js',
                feedback: 'go-app-feedback.js',
                smsinbound: 'go-app-smsinbound.js'
            },
            test: {
                registration: [
                    'test/setup.js',
                    'src/utils.js',
                    '<%= paths.src.app.registration %>',
                    'test/registration.test.js'
                ],
                feedback: [
                    'test/setup.js',
                    'src/utils.js',
                    '<%= paths.src.app.feedback %>',
                    'test/feedback.test.js'
                ],
                smsinbound: [
                    'test/setup.js',
                    'src/utils.js',
                    '<%= paths.src.app.smsinbound %>',
                    'test/smsinbound.test.js'
                ]
            }
        },

        jshint: {
            options: {jshintrc: '.jshintrc'},
            all: [
                'Gruntfile.js',
                '<%= paths.src.all %>'
            ]
        },

        watch: {
            src: {
                files: [
                    '<%= paths.src.all %>'
                ],
                tasks: ['default'],
                options: {
                    atBegin: true
                }
            }
        },

        concat: {
            options: {
                banner: [
                    '// WARNING: This is a generated file.',
                    '//          If you edit it you will be sad.',
                    '//          Edit src/app.js instead.',
                    '\n' // Newline between banner and content.
                ].join('\n')
            },

            registration: {
                src: ['<%= paths.src.registration %>'],
                dest: '<%= paths.dest.registration %>'
            },

            feedback: {
                src: ['<%= paths.src.feedback %>'],
                dest: '<%= paths.dest.feedback %>'
            },

            smsinbound: {
                src: ['<%= paths.src.smsinbound %>'],
                dest: '<%= paths.dest.smsinbound %>'
            },

        },

        mochaTest: {
            options: {
                reporter: 'spec'
            },
            test_registration: {
                src: ['<%= paths.test.registration %>']
            },
            test_feedback: {
                src: ['<%= paths.test.feedback %>']
            },
            test_smsinbound: {
                src: ['<%= paths.test.smsinbound %>']
            }
        }
    });

    grunt.registerTask('test', [
        'jshint',
        'build',
        'mochaTest'
    ]);

    grunt.registerTask('build', [
        'concat',
    ]);

    grunt.registerTask('default', [
        'build',
        'test'
    ]);
};
