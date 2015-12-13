
module.exports = function () {

    return {
        connections: [ { port: 5001 }],
        plugins: {
            './lib/modules/validate': { validateFile: '/content/validate/validate.json', relativeTo: '/' },
            './lib/modules/xmlFiles': { filePath: '/content/xml', relativeTo: '/' },
            'good': {
                reporters: {


                }
            }
        }
    };
};
