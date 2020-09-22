import React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import StepModal from "../../common/StepModalWizard";

class ImageUpload extends React.Component {

  constructor() {
    super();
  }

  render() {
    return <StepModal
      showNext={false}
      showSkip={this.state.showSkip}
      currentPage={this.state.currentPage}
      stepComponents={[createNSPage, confirmPage, broadcastPage]}
      onFinish={this.KeyValueCreationFinish}
      onNext={this.KeyValueCreationNext}
      onCancel={this.KeyValueCreationCancel}/>
  }

}