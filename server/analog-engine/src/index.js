'use strict';

module.exports = {
  ...require('./router'),
  ...require('./challenge'),
  ...require('./scoring'),
  ...require('./loader'),
  ...require('./profiles')
};
