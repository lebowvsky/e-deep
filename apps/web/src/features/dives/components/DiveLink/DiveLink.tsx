import { Link, useLocation, type LinkProps } from 'react-router';
import { diveDetailPath, toDetailLinkState } from '../../lib/backLink';

export interface DiveLinkProps extends Omit<LinkProps, 'to' | 'state'> {
  diveId: string;
}

/**
 * Link from the dive log to a dive detail. It carries the current selection (query string) in the
 * router state, so that « Mes plongées » on the detail page brings the user back to it.
 */
export function DiveLink({ diveId, ...rest }: DiveLinkProps) {
  const { search } = useLocation();
  return <Link to={diveDetailPath(diveId)} state={toDetailLinkState(search)} {...rest} />;
}
