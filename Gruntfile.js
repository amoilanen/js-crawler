module.exports = function(grunt) {

  grunt.initConfig({
    eslint: {
      target: ['Gruntfile.js', 'crawler.js']
    }
  });

  grunt.loadNpmTasks('grunt-eslint');

  grunt.registerTask('default', ['eslint']);
};