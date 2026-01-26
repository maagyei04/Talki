import { Theme } from '@/src/services/config/theme';
import { normalize } from '@/src/shared/utils/helpers/dimensions';
import { createText } from '@shopify/restyle';
import { ComponentProps, FC } from 'react';
import { Platform, TextProps as RNTextProps } from 'react-native';


export interface ResponsiveTextProps {
    responsiveFontSize?: number;
    responsiveLineHeight?: number;
}

const BaseText = createText<Theme>();

const Text: FC<ComponentProps<typeof BaseText> & ResponsiveTextProps & RNTextProps> = ({
    responsiveFontSize,
    responsiveLineHeight,
    style,
    ...rest
}) => {
    return (
        <BaseText
            {...rest}
            style={[
                {
                    fontSize: responsiveFontSize ? normalize(responsiveFontSize) : undefined,
                    lineHeight: responsiveLineHeight ? normalize(responsiveLineHeight) : undefined,
                    ...Platform.select({
                        android: {
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                        },
                    }),
                },
                style,
            ]}
        />
    );
};

export default Text;