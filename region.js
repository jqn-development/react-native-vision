import React, { Component } from "react";
import PropTypes from "prop-types";
import { RNVisionConsumer } from "./wrapper";
import * as Module from "./module";
import { bundleURL } from "./RNSwiftBridge";
class Region extends Component {
  state = {
    classifiers: null,
    generators: null,
    generics: null,
    bottlenecks: null,
    classifications: {},
    genericResults: {},
    frameListener: null
  };
  static getDerivedStateFromProps(nextProps, prevState) {
    var ret = prevState;
    if (!ret.todos) ret.todos = {};
    if (prevState.frameListener != nextProps.onFrameCaptured) {
      if (nextProps.onFrameCaptured) {
        //Turn it on!
        Module.saveFrame(
          nextProps.region,
          nextProps.frameDisposition ? nextProps.frameDisposition : "file",
          body => {
            nextProps.onFrameCaptured(body);
          }
        );
      } else {
        Module.removeSaveFrame(nextProps.region);
      }
      ret.frameListener = nextProps.onFrameCaptured;
    }
    if (nextProps.classifiers != prevState.classifiers) {
      if (nextProps.classifiers)
        if (Array.isArray(nextProps.classifiers))
          nextProps.classifiers
            .filter(({ url }) => Boolean)
            .map(o => ({ ...o, url: fixURL(o.url) }))
            .forEach(obj => {
              const { url, max: maxCount } = obj;
              if (
                prevState.classifiers &&
                prevState.classifiers.filter(o => {
                  return o.url == url && o.max == maxCount;
                }).length
              )
                return;

              if (!ret.todos.addMLClassifiers) ret.todos.addMLClassifiers = [];
              ret.todos.addMLClassifiers.push(obj);
            });
        else
          Object.keys(nextProps.classifiers).forEach(k => {
            const maxCount = nextProps.classifiers[k];
            if (
              prevState.classifiers[k] &&
              prevState.classifiers[k] == maxCount
            )
              return;
            if (!ret.todos.addMLClassifiers) ret.todos.addMLClassifiers = [];
            if (k)
              ret.todos.addMLClassifiers.push({
                url: fixURL(k),
                max: maxCount
              });
          });
      if (prevState.classifiers)
        if (Array.isArray(prevState.classifiers))
          prevState.classifiers.forEach(obj => {
            if (
              !nextProps.classifiers ||
              !nextProps.classifiers.filter(nobj => {
                return nobj.url == obj.url;
              }).length
            ) {
              Module.removeML(nextProps.region, obj.url);
              delete ret.classifications[obj.url];
            }
          });
        else
          Object.keys(prevState.classifiers).forEach(k => {
            if (
              !nextProps.classifiers ||
              typeof nextProps.classifiers[k] == "undefined"
            ) {
              Module.removeML(nextProps.region, k);
              delete ret.classifications[k];
            }
          });
      ret.classifiers = nextProps.classifiers;
    }
    if (nextProps.generators != prevState.generators) {
      if (nextProps.generators)
        if (Array.isArray(nextProps.generators))
          nextProps.generators
            .map(o => ({ ...o, url: fixURL(o.url) }))
            .forEach(obj => {
              const { url, type } = obj;
              if (
                prevState.generators &&
                prevState.generators.filter(o => {
                  const ret = o.url == url && o.type == type;
                  return ret;
                }).length
              )
                return;
              if (!ret.todos.addMLGenerators) ret.todos.addMLGenerators = [];
              console.log("Adding a generator!!!!", obj);
              ret.todos.addMLGenerators.push(obj);
            });
      if (prevState.generators)
        if (Array.isArray(prevState.generators))
          prevState.generators.forEach(obj => {
            if (
              !nextProps.generators ||
              !nextProps.generators.filter(nobj => {
                return nobj.url == obj.url;
              }).length
            ) {
              Module.removeML(nextProps.region, obj.url);
              delete ret.generators;
            }
          });
      ret.generators = nextProps.generators;
    }
    if (nextProps.bottlenecks != prevState.bottlenecks) {
      //Update bottlenecks - keys are the bottleneck URLS, values are an object of keys generators, generics, classifiers - examine them all
      if (nextProps.bottlenecks)
        Object.keys(nextProps.bottlenecks).forEach(k => {
          //@TODO MUST ACTUALLY CREATE BOTTLENECK SUPPORT
          const v = nextProps.bottlenecks[k];
        });
      Object.keys(prevState.bottlenecks).forEach(k => {
        //Look for no-longer operative bottlenecks and remove them
        if (typeof nextProps.classifiers[k] == "undefined") {
          Module.removeML(nextProps.region, k);
        }
      });
      ret.bottlenecks = nextProps.bottlenecks;
    }
    return ret;
  }
  componentDidUpdate() {
    this.manageTodo();
  }
  componentDidMount() {
    this.manageTodo();
  }
  componentWillUnmount() {
    try {
      Module.removeSaveFrame(this.props.region);
    } catch (e) {}
    this.state.classifiers &&
      this.state.classifiers.map(u =>
        Module.removeML(this.props.region, u.url)
      );
    this.state.generators &&
      this.state.generators.map(u => Module.removeML(this.props.region, u));
    this.state.generics &&
      this.state.generics.map(u => Module.removeML(this.props.region, url));
    this.state.bottlenecks &&
      Object.keys(this.state.bottlenecks).map(u =>
        Module.removeML(this.props.region, u)
      );
  }
  manageTodo() {
    if (this.state.todos) {
      Object.keys(this.state.todos).forEach(k => {
        if (typeof this[k] == "function") this[k](this.state.todos[k]);
        else console.log("No todo function for key ", k);
      });
      // console .log("Running setstate from region todo");
      //this.setState({ todos: null });
    }
  }
  cachedDate = {};
  addMLClassifiers(classifiers) {
    classifiers.forEach(obj => {
      const url = obj.url;
      const maxCount = obj.max;
      Module.applyMLClassifier(
        this.props.region,
        url,
        maxCount,
        newClassifications => {
          const now = Date.now();
          if (now < parseInt(this.cachedDate[this.props.region + url]) + 50)
            return;
          this.setState(({ classifications }) => {
            return {
              classifications: {
                ...classifications,
                [url]: newClassifications
              }
            };
          });
          this.cachedDate[this.props.region + url] = now;
        }
      );
    });
  }
  addMLGenerators(generators) {
    generators.forEach(o => {
      const url = o.url;
      Module.applyMLGenerator(this.props.region, url, o.type, data => {
        if (Array.isArray(this.state.generators))
          this.state.generators
            .filter(obj => {
              return obj.url == url;
            })
            .forEach(obj => {
              obj.callback(data);
            });
        else this.state.generators[url].callback(data);
      });
    });
  }
  render() {
    return typeof this.props.children == "function" ? (
      <RNVisionConsumer>
        {value => {
          if (!value) return;
          const region = value.regions[this.props.region];
          const regionInfo = {
            ...region,
            imageDimensions: value.imageDimensions,
            isCameraFront: value.isCameraFront,
            classifications: this.state.classifications,
            classification:
              this.state.classifications &&
              Object.values(this.state.classifications)[0],
            label:
              this.state.classifications &&
              Object.values(this.state.classifications)[0] &&
              Object.values(this.state.classifications)[0][0].label,
            confidence:
              this.state.classifications &&
              Object.values(this.state.classifications)[0] &&
              Object.values(this.state.classifications)[0][0].confidence,
            genericResults: this.state.genericResults
          };
          return this.props.children(regionInfo);
        }}
      </RNVisionConsumer>
    ) : (
      this.props.children && this.props.children
    );
  }
}
Region.propTypes = {
  region: PropTypes.string.isRequired,
  classifiers: PropTypes.array,
  generators: PropTypes.array,
  generics: PropTypes.array,
  bottlenecks: PropTypes.object,
  // children: PropTypes.func,
  onFrameCaptured: PropTypes.func,
  frameDisposition: PropTypes.string
};
const fixURL = url => {
  //ask if this is a URL
  if (!url) {
    throw "Bad URL PASSED! I AM SAD";
  }
  if (url.includes("://")) return url;
  if (url.endsWith(".mlmodel")) url = url + "c";
  if (!url.endsWith(".mlmodelc")) url = url + ".mlmodelc";
  const final = bundleURL + url;
  return final;
};

const RNVDefaultRegion = props => <Region {...props} region="" />;
export default Region;
export { Region as RNVRegion, RNVDefaultRegion, fixURL };
