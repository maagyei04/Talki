import { Theme } from '@/src/services/config/themes';
import { heightScale, widthScale } from '@/src/shared/utils/helpers/dimensions';
import { createBox } from '@shopify/restyle';
import { ComponentProps } from 'react';
import { ViewProps } from 'react-native';


export interface ResponsiveProps {
    responsiveWidth?: number;
    responsiveHeight?: number;
    responsivePadding?: number;
    responsivePaddingTop?: number;
    responsivePaddingBottom?: number;
    responsiveMargin?: number;
    responsiveMarginTop?: number;
    responsiveMarginBottom?: number;
}

const BaseBox = createBox<Theme>();

type BoxProps = ComponentProps<typeof BaseBox> & ResponsiveProps & ViewProps;

const getThemeSpacing = (value: number): keyof Theme['spacing'] => {
    const spacingMap: Record<number, keyof Theme['spacing']> = {
        4: 'xs',
        8: 's',
        16: 'm',
        24: 'l',
        32: 'xl',
        40: 'xxl'
    };
    return spacingMap[value] || 'm';
};

const Box = ({
    responsiveWidth,
    responsiveHeight,
    responsivePadding,
    responsivePaddingTop,
    responsivePaddingBottom,
    responsiveMargin,
    responsiveMarginTop,
    responsiveMarginBottom,
    width,
    height,
    padding,
    paddingTop,
    paddingBottom,
    margin,
    marginTop,
    marginBottom,
    ...rest
}: BoxProps) => {
    return (
        <BaseBox
            {...rest}
            width={responsiveWidth ? responsiveWidth * widthScale : width}
            height={responsiveHeight ? responsiveHeight * heightScale : height}
            padding={responsivePadding ? getThemeSpacing(responsivePadding) : padding}
            paddingTop={responsivePaddingTop ? getThemeSpacing(responsivePaddingTop) : paddingTop}
            paddingBottom={responsivePaddingBottom ? getThemeSpacing(responsivePaddingBottom) : paddingBottom}
            margin={responsiveMargin ? getThemeSpacing(responsiveMargin) : margin}
            marginTop={responsiveMarginTop ? getThemeSpacing(responsiveMarginTop) : marginTop}
            marginBottom={responsiveMarginBottom ? getThemeSpacing(responsiveMarginBottom) : marginBottom}
        />
    );
};

export default Box;