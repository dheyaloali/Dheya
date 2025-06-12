import * as React from "react";
import { Button, ButtonProps } from "./button";
import { Loader2 } from "lucide-react";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (props: LoadingButtonProps, ref) => {
    const { loading: loadingProp, loadingText, disabled, children, onClick, ...rest } = props;
    const [internalLoading, setInternalLoading] = React.useState(false);
    const isControlled = loadingProp !== undefined;
    const loading = isControlled ? loadingProp : internalLoading;

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      if (loading) return;
      if (!isControlled) setInternalLoading(true);
      try {
        await onClick?.(e);
      } finally {
        if (!isControlled) setInternalLoading(false);
      }
    };

    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        onClick={handleClick}
        {...rest}
      >
        {loading && (
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
        )}
        {loading ? loadingText || children : children}
      </Button>
    );
  }
);
LoadingButton.displayName = "LoadingButton"; 