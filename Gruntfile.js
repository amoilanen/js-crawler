require('grunt-karma');

module.exports = function(grunt) {

  grunt.initConfig({
    eslint: {
      target: ['Gruntfile.js', 'crawler.js', 'spec/**/*.js']
    },
    karma: {
      options: {
        frameworks: ['jasmine', 'browserify'],
        files: ['crawler.js', 'spec/*.spec.js'],
        browsers: ['PhantomJS'],
        singleRun: true,
        preprocessors: {
          'crawler.js': ['browserify'],
          'spec/**/*.js': ['browserify']
        },
        browserify: {
          debug: true
        }
      },
      unit: {
        files: [
          {
            src: ['spec/**/*.js']
          }
        ]
      },
      unit_browser: {
        browsers: ['Firefox'],
        reporters: ['kjhtml'],
        singleRun: false
      }
    }
  });

  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-karma');

  grunt.registerTask('default', ['eslint', 'karma:unit']);
};