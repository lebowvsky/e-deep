import { diveWriteRequest } from '../../../../../test/support/dive-write-request';
import { requestConsistencyErrors } from './request-consistency';

const SITE_ID = '01900000-0000-7000-8000-0000000000aa';
const OTHER_ID = '01900000-0000-7000-8000-0000000000bb';

describe('requestConsistencyErrors', () => {
  it('accepts matching ids, whatever their case', () => {
    const request = diveWriteRequest({ event: { siteId: SITE_ID }, site: { id: SITE_ID } });
    const upper = { ...request, site: { ...request.site, id: SITE_ID.toUpperCase() } };

    expect(requestConsistencyErrors(upper, request.event.id.toUpperCase())).toEqual({});
  });

  it('reports an event site that is not the site of the request', () => {
    const request = diveWriteRequest({ event: { siteId: SITE_ID }, site: { id: OTHER_ID } });

    expect(requestConsistencyErrors(request)).toEqual({ 'event.siteId': ['matches-site'] });
  });

  it('reports an event id that is not the id of the route', () => {
    expect(requestConsistencyErrors(diveWriteRequest(), OTHER_ID)).toEqual({
      'event.id': ['matches-route'],
    });
  });
});
