import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorBrandForeground1,
  },
});

interface AppSymbolProps {
  size?: number;
}

export default function AppSymbol({ size = 40 }: AppSymbolProps) {
  const classes = useStyles();

  return (
    <span className={classes.root} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path d="M18 24C21 17 26 14 32 14C38 14 43 17 46 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M18 40C21 47 26 50 32 50C38 50 43 47 46 40" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        <circle cx="32" cy="31" r="8" fill="currentColor" opacity="0.2" />
        <circle cx="32" cy="31" r="4" fill="currentColor" />
        <path d="M28 39L39 31L28 23V39Z" fill="currentColor" opacity="0.85" />
      </svg>
    </span>
  );
}
