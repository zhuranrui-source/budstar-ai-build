import { Button, Text, View } from '@tarojs/components';

export type PageStateProps = {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
};

export default function PageState({
  kind,
  title,
  description,
  actionText,
  onAction,
}: PageStateProps) {
  return (
    <View className={`state-view state-view--${kind}`}>
      <View className="state-icon">
        <Text>{kind === 'loading' ? '…' : kind === 'error' ? '!' : '○'}</Text>
      </View>
      <Text className="state-title">{title}</Text>
      {description ? (
        <Text className="state-description">{description}</Text>
      ) : null}
      {actionText && onAction ? (
        <Button className="state-action" size="mini" onClick={onAction}>
          {actionText}
        </Button>
      ) : null}
    </View>
  );
}
