class Script {
  constructor(config) {
    config = { ...config };
    this._name = config.name || 'script';

    this.renderName = this.renderName.bind(this);
  }

  renderName() {
    return this._name;
  }
}

module.exports = Script;
