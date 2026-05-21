import { Text as RNText, TextProps } from 'react-native';

type Weight = 'medium' | 'semibold' | 'bold';

interface Props extends TextProps {
  weight?: Weight;
  className?: string;
}

const weightClass: Record<Weight, string> = {
  medium: 'font-manrope-medium',
  semibold: 'font-manrope-semibold',
  bold: 'font-manrope-bold',
};

export default function Text({ weight = 'medium', className = '', ...props }: Props) {
  return <RNText className={`${weightClass[weight]} ${className}`} {...props} />;
}
