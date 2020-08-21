import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import React, { Component } from "react";
import Modal from "react-native-modal";

import KevaColors from "./KevaColors";


export default class StepModal extends Component {
  constructor(props) {
    super(props);
  }

  _renderNextButton() {
    const onNext = this.props.onNext;
    return (
      <View
        style={{
          marginRight: 10
        }}
      >
        <TouchableOpacity
          onPress={() => {
            onNext && onNext();
          }}
        >
          <Text style={{ color: "#60bca5", fontSize: 16 }}>
            {"Next"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  _renderFinishButton() {
    let onFinish = this.props.onFinish;
    return (
      <View
        style={{
          marginRight: 10
        }}
      >
        <TouchableOpacity
          onPress={() => {
              return onFinish && onFinish();
            }
          }
        >
          <Text style={{ color: "#60bca5", fontSize: 16 }}>
            {"Finish"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  _renderSkipButton() {
    let onCancel = this.props.onCancel;
    return (
      <View
        style={{
          marginLeft: 10
        }}
      >
        <TouchableOpacity
          onPress={() => {
            return onCancel && onCancel();
          }}
        >
          <Text style={{ color: KevaColors.actionText, fontSize: 16 }}>
            {"Cancel"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  isLastStep() {
    return this.props.stepComponents.length - 1 === this.props.currentPage;
  }

  render() {
    let {stepComponents, showNext, showSkip} = this.props;

    return (
      <View>
        <Modal isVisible={true}>
          <View
            style={customStyles.modal}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 16 }}
            >
              {
                this.isLastStep()
                  ? <View />
                  : (showSkip && this._renderSkipButton())
              }

              {
                showNext && (this.isLastStep()
                  ? this._renderFinishButton()
                  : this._renderNextButton())
              }
            </View>
            <View
              style={{
                marginTop: 17,
                backgroundColor: "#ffffff",
                marginLeft: 10,
                marginRight: 10,
                alignItems: "center",
              }}
            >
              { stepComponents[this.props.currentPage] }
            </View>
          </View>
        </Modal>
      </View>
    );
  }
}

const customStyles = StyleSheet.create({
  centerAlignDiv: {
    // flex:1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  },
  bold: {
    fontWeight: "bold"
  },
  card: {
    width: 145,
    height: 138,
    marginTop: 30,
    marginBottom: 30,
    // paddingBottom:30,
    // paddingTop:30,
    backgroundColor: "#25355b",
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: "#596582",
    borderRadius: 4
  },
  notificationText: {
    backgroundColor: "transparent",
    textAlign: "center",
    fontSize: 16,
    color: "#ffffff"
  },
  blueColorText: {
    color: "#435270"
  },
  circularImage: {
    height: 36,
    width: 36,
    borderRadius: 18
  },
  button: {
    marginTop: 15,
    marginBottom: 20,
    marginLeft: 10,
    marginRight: 10,
    backgroundColor: "#60bca5",
    paddingTop: 13,
    paddingBottom: 13,
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  },
  backgroundImage: {
    backgroundColor: "transparent"
  },
  infoBox: {
    flexDirection: "row",
    paddingLeft: 10,
    paddingRight: 10,
    marginTop: 18
  },
  itemView: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingLeft: 15,
    paddingRight: 10,
    paddingTop: 15,
    paddingBottom: 15,
    marginTop: 5,
    borderRadius: 4,
    marginLeft: 12,
    marginRight: 12,
    flexDirection: "row",
    borderColor: "#ececec",
    borderWidth: 1
  },
  itemViewSelected: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingLeft: 15,
    paddingRight: 10,
    paddingTop: 15,
    paddingBottom: 15,
    marginTop: 5,
    borderRadius: 4,
    marginLeft: 12,
    marginRight: 12,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#d0021b"
  },
  item: {
    backgroundColor: "#ffffff",
    paddingLeft: 15,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    marginTop: 5,
    borderRadius: 4,
    marginLeft: 12,
    marginRight: 12,
    borderColor: "#ececec",
    borderWidth: 1
  },
  itemSelected: {
    backgroundColor: "#ffffff",
    paddingLeft: 15,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    marginTop: 5,
    borderRadius: 4,
    marginLeft: 12,
    marginRight: 12,
    borderColor: "#d0021b",
    borderWidth: 1
  },
  itemTextIndent: {
    textAlign: "left",
    marginLeft: 10
  },
  itemText: {
    textAlign: "left",
    marginLeft: 15
  },
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingBottom: 10,
    flex: 0
  },
});
