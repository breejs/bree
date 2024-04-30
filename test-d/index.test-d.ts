import { expectType } from 'tsd';
import Bree from '../src';

const bree = new Bree({});

expectType<Bree>(bree);

expectType<Bree['start']>(bree.start);
expectType<Bree['stop']>(bree.stop);
expectType<Bree['run']>(bree.run);
expectType<Bree['add']>(bree.add);
expectType<Bree['remove']>(bree.remove);
expectType<Bree['createWorker']>(bree.createWorker);
