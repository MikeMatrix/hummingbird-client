import Component from 'ember-component';
import computed from 'ember-computed';
import get from 'ember-metal/get';
import service from 'ember-service/inject';
import { task } from 'ember-concurrency';
import errorMessages from 'client/utils/error-messages';

export default Component.extend({
  ajax: service(),
  notify: service(),

  deleteActivity: task(function* (activity) {
    const activityId = get(activity, 'id');
    const actorId = get(activity, 'actor.id');
    const feedUrl = `/feeds/user/${actorId}/activities/${activityId}`;
    yield get(this, 'ajax').delete(feedUrl).then(() => {
      get(this, 'activities').removeObject(activity);
      get(this, 'notify').success('Your feed activity was deleted.');
    }).catch(err => get(this, 'notify').error(errorMessages(err)));
  }).enqueue(),

  shouldGroup: computed('feedId', {
    get() {
      const [feed] = get(this, 'feedId').split(':');
      return feed !== 'user_aggr';
    }
  }).readOnly(),

  groupedActivities: computed('activities.[]', {
    get() {
      if (get(this, 'shouldGroup') === false) {
        return get(this, 'activities')
          .map(activity => ({ activity })).slice(0, get(this, 'activityLimit'));
      }
      const groups = {};
      const activities = get(this, 'activities');
      activities.forEach((activity) => {
        const key = this._getGroupingKey(activity);
        groups[key] = groups[key] || [];
        groups[key].addObject(activity);
      });
      const result = [];
      Object.keys(groups).forEach((key) => {
        const group = groups[key];
        const others = group.toArray().slice(1).reject(a => (
          get(a, 'actor.id') === get(group, 'firstObject.actor.id')
        ));
        result.addObject({
          activity: get(group, 'firstObject'),
          others
        });
      });
      return result.slice(0, get(this, 'activityLimit'));
    }
  }).readOnly(),


  _getGroupingKey(activity) {
    const verb = get(activity, 'verb');
    switch (verb) {
      case 'updated':
        return `${verb}_${get(activity, 'status')}`;
      case 'progressed':
        return `${verb}_${get(activity, 'progress')}`;
      case 'rated':
        return `${verb}_${get(activity, 'rating')}`;
      default:
        throw new Error('Unsupported activity.');
    }
  },

  actions: {
    deleteActivity(activity) {
      get(this, 'deleteActivity').perform(activity);
    }
  }
});
