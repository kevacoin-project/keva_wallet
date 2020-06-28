import React, { useEffect, useState } from 'react';
import { ScrollView, Platform, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { BlueLoading, BlueText, BlueSpacing20, BlueListItem, SafeBlueArea, BlueNavigationStyle, BlueCard } from '../../BlueComponents';
import PropTypes from 'prop-types';
import { AppStorage } from '../../class';
import { useNavigation } from 'react-navigation-hooks';
import HandoffSettings from '../../class/handoff';
let BlueApp: AppStorage = require('../../BlueApp');
let loc = require('../../loc');
import { enableStatus } from '../../util';

const GeneralSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdancedModeEnabled, setIsAdancedModeEnabled] = useState(false);
  const [isHandoffUseEnabled, setIsHandoffUseEnabled] = useState(false);
  const [isStatusEnabled, setIsStatusEnabled] = useState(false);
  const { navigate } = useNavigation();
  const onAdvancedModeSwitch = async value => {
    await BlueApp.setIsAdancedModeEnabled(value);
    setIsAdancedModeEnabled(value);
  };

  const onHandOffEnabledSwitch = async value => {
    await HandoffSettings.setHandoffUseEnabled(value);
    setIsHandoffUseEnabled(value);
  };

  const onStatusSwitch = async value => {
    await BlueApp.setIsStatusEnabled(value);
    setIsStatusEnabled(value);
    enableStatus(value);
  };

  useEffect(() => {
    (async () => {
      setIsAdancedModeEnabled(await BlueApp.isAdancedModeEnabled());
      setIsStatusEnabled(await BlueApp.isStatusEnabled());
      setIsHandoffUseEnabled(await HandoffSettings.isHandoffUseEnabled());
      setIsLoading(false);
    })();
  });

  return isLoading ? (
    <BlueLoading />
  ) : (
    <SafeBlueArea forceInset={{ horizontal: 'always' }} style={{ flex: 1 }}>
      <ScrollView>
        {BlueApp.getWallets().length > 1 && (
          <>
            <BlueListItem component={TouchableOpacity} onPress={() => navigate('DefaultView')} title="On Launch" chevron />
          </>
        )}
        {Platform.OS === 'ios' ? (
          <>
            <BlueListItem
              hideChevron
              title={'Continuity'}
              Component={TouchableWithoutFeedback}
              switch={{ onValueChange: onHandOffEnabledSwitch, value: isHandoffUseEnabled }}
            />
            <BlueCard>
              <BlueText>
                When enabled, you will be able to view selected wallets, and transactions, using your other Apple iCloud connected devices.
              </BlueText>
            </BlueCard>
            <BlueSpacing20 />
          </>
        ) : null}
        <BlueListItem
          Component={TouchableWithoutFeedback}
          title={loc.settings.enable_advanced_mode}
          switch={{ onValueChange: onAdvancedModeSwitch, value: isAdancedModeEnabled }}
        />
        <BlueCard>
          <BlueText>
            {loc.settings.advanced_mode_note}
          </BlueText>
        </BlueCard>
        <BlueSpacing20 />
        <BlueListItem
          Component={TouchableWithoutFeedback}
          title={"Show Refreshing Status"}
          switch={{ onValueChange: onStatusSwitch, value: isStatusEnabled }}
        />
      </ScrollView>
    </SafeBlueArea>
  );
};

GeneralSettings.navigationOptions = () => ({
  ...BlueNavigationStyle(),
  title: loc.settings.general,
});

GeneralSettings.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
    popToTop: PropTypes.func,
    goBack: PropTypes.func,
  }),
};

export default GeneralSettings;
