import { expectType, expectNotType } from 'tsd';
import Bree from '..';

const bree = new Bree({});

expectType<Bree.Constructor>(Bree);
expectType<Bree.Bree>(bree);
