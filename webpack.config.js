module.exports = {
    entry: './lib/index',

    output: {
        filename: 'typed-objects.js',
        path: 'release'
    },

    module: {
        loaders: [
            {
                test: /\.js/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            }
        ]
    }
};
