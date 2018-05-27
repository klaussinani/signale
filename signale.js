'use strict';
const path = require('path');
const chalk = require('chalk');
const figures = require('figures');
const pkgConf = require('pkg-conf');
const types = require('./types');
const pkg = require('./package.json');

const defaults = pkg.options.default;
const namespace = pkg.name;

const now = () => Date.now();
const timeSpan = then => {
  return (now() - then);
};

class Signale {
  constructor(options = {}) {
    this._config = Object.assign(this.packageConfiguration, options.config);
    this._customTypes = Object.assign({}, options.types);
    this._scopeName = options.scope || '';
    this._timers = new Map();
    this.__timers = options.timers || {start: {}, end: {}};
    this._types = Object.assign({}, types, this._customTypes);
    this._stream = options.stream || process.stdout;
    this._longestLabel = types.start.label.length;

    Object.keys(options).forEach(type => {
      this[type] = options[type];
    });

    Object.keys(this._types).forEach(type => {
      this[type] = this._logger.bind(this, type);
    });

    for (const type in this._types) {
      if (this._types[type].label && this._types[type].label.length > this._longestLabel) {
        this._longestLabel = this._types[type].label.length;
      }
    }
  }

  get scopeName() {
    return this._scopeName;
  }

  get currentOptions() {
    return Object.assign({}, {
      config: this._config,
      types: this._customTypes,
      timers: this._timers,
      stream: this._stream
    });
  }

  get date() {
    return new Date().toLocaleDateString();
  }

  get timestamp() {
    return new Date().toLocaleTimeString();
  }

  get filename() {
    const _ = Error.prepareStackTrace;
    Error.prepareStackTrace = (error, stack) => stack;
    const {stack} = new Error();
    Error.prepareStackTrace = _;

    const callers = stack.map(x => path.basename(x.getFileName()));

    return callers.find(x => {
      return x !== callers[0];
    });
  }

  get packageConfiguration() {
    return pkgConf.sync(namespace, {defaults});
  }

  set configuration(configObj) {
    this._config = Object.assign(this.packageConfiguration, configObj);
  }

  _logger(type, ...messageObj) {
    this._log(this._buildSignale(this._types[type], ...messageObj));
  }

  _log(message) {
    this._stream.write(message + '\n');
  }

  _formatDate() {
    return `[${this.date}]`;
  }

  _formatFilename() {
    return `[${this.filename}]`;
  }

  _formatScopeName() {
    if (Array.isArray(this._scopeName)) {
      const scopes = this._scopeName.filter(x => x.length !== 0);
      return `${scopes.map(x => `[${x.trim()}]`).join(' ')}`;
    }
    return `[${this._scopeName}]`;
  }

  _formatTimestamp() {
    return `[${this.timestamp}]`;
  }

  _meta() {
    const meta = [];
    if (this._config.displayDate) {
      meta.push(this._formatDate());
    }
    if (this._config.displayTimestamp) {
      meta.push(this._formatTimestamp());
    }
    if (this._config.displayFilename) {
      meta.push(this._formatFilename());
    }
    if (this._scopeName.length !== 0 && this._config.displayScope) {
      meta.push(this._formatScopeName());
    }
    if (meta.length !== 0) {
      meta.push(`${figures.pointerSmall}`);
      return meta.map(item => chalk.grey(item));
    }
    return meta;
  }

  _buildSignale(type, ...args) {
    let [msg, additional] = [{}, {}];

    if (args.length === 1 && typeof (args[0]) === 'object' && args[0] !== null) {
      if (args[0] instanceof Error) {
        [msg] = args;
      } else {
        const [{prefix, message, suffix}] = args;
        msg = message;
        additional = Object.assign({}, {suffix, prefix});
      }
    } else {
      msg = args.join(' ');
    }

    const signale = this._meta();

    if (additional.prefix) {
      if (this._config.underlinePrefix) {
        signale.push(chalk.underline(additional.prefix));
      } else {
        signale.push(additional.prefix);
      }
    }

    if (this._config.displayBadge && type.badge) {
      signale.push(chalk[type.color](type.badge.padEnd(type.badge.length + 1)));
    }

    if (this._config.displayLabel && type.label) {
      const label = this._config.uppercaseLabel ? type.label.toUpperCase() : type.label;
      if (this._config.underlineLabel) {
        signale.push(chalk[type.color].underline(label).padEnd(this._longestLabel + 20));
      } else {
        signale.push(chalk[type.color](label.padEnd(this._longestLabel + 1)));
      }
    }

    if (msg instanceof Error) {
      const [name, ...rest] = msg.stack.split('\n');
      if (this._config.underlineMessage) {
        signale.push(chalk.underline(name));
      } else {
        signale.push(name);
      }
      signale.push(chalk.grey(rest.map(l => l.replace(/^/, '\n')).join('')));
      return signale.join(' ');
    }

    if (this._config.underlineMessage) {
      signale.push(chalk.underline(msg));
    } else {
      signale.push(msg);
    }

    if (additional.suffix) {
      if (this._config.underlineSuffix) {
        signale.push(chalk.underline(additional.suffix));
      } else {
        signale.push(additional.suffix);
      }
    }

    return signale.join(' ');
  }

  config(configObj) {
    this.configuration = configObj;
  }

  scope(...name) {
    if (name.length === 0) {
      throw new Error('No scope name was defined.');
    }
    return new Signale(Object.assign(this.currentOptions, {scope: name}));
  }

  unscope() {
    this._scopeName = '';
  }

  textType(text) {
    let textType = null;
    switch (typeof text) {
      case 'string':
        textType = 'string';
        break;
      case 'object':
        textType = 'object';
        break;
      case 'boolean':
        textType = 'boolean';
        break;
      default:
        textType = null;
        break;
    }
    return textType;
  }

  time(label, options) {
    if (!label) {
      label = `timer_${this._timers.size}`;
    }

    if (options) {
      if (options.both) {
        Object.keys(options.both).forEach(key => {
          this.__timers.start[key] = options.both[key];
          this.__timers.end[key] = options.both[key];
        });
      } else {
        if (options.start) {
          this.__timers.start = options.start;
        }

        if (options.end) {
          this.__timers.end = options.end;
        }

        Object.keys(options).forEach(key => {
          this.__timers.start[key] = options[key];
          this.__timers.end[key] = options[key];
        });
      }
    }

    this._timers.set(label, Date.now());
    const message = this._meta();

    const timerStart = this.__timers.start;

    const __color = chalk[timerStart.color] || chalk.green;
    const __badge = timerStart.badge || this._types.start.badge;
    const __text = this.textType(timerStart.text) === 'object' ? timerStart.text.join(' ') : timerStart.text || 'Initialized timer...';

    const report = [
      __color(__badge.padEnd(4)),
      __color.underline(label).padEnd(this._longestLabel + 22),
      __text
    ];

    message.push(...report);
    this._log(message.join(' '));

    return label;
  }

  timeEnd(label) {
    if (!label && this._timers.size) {
      const is = x => x.includes('timer_');
      label = [...this._timers.keys()].reduceRight((x, y) => {
        return is(x) ? x : (is(y) ? y : null);
      });
    }

    if (this._timers.has(label)) {
      const span = timeSpan(this._timers.get(label));
      this._timers.delete(label);

      const message = this._meta();

      const executionTime = span < 1000 ? span + 'ms' : (span / 1000).toFixed(2) + 's';
      const timerEnd = this.__timers.end || {};

      const __color = chalk[timerEnd.color] || chalk.red;
      const __badge = timerEnd.badge || this._types.pause.badge;
      const __executionColor = chalk[timerEnd.time] || chalk.yellow;
      const __text = this.textType(timerEnd.text) === 'object' ? timerEnd.text.join().replace(',', ` ${__executionColor(executionTime)} `) : timerEnd.text || `Timer run for: ${__executionColor(executionTime)}`;

      const report = [
        __color(__badge.padEnd(4)),
        __color.underline(label).padEnd(this._longestLabel + 22),
        __text
      ];

      message.push(...report);

      this._log(message.join(' '));
      return {label, span};
    }
  }
}

module.exports = Signale;
